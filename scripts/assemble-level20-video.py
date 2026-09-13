#!/usr/bin/env python3
"""Verify and losslessly join the twenty native level-20 recording shards.

Usage: python3 assemble-level20-video.py [--input input] [--output video]
Only reads capture artifacts and remuxes their video; it never loads game code.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from fractions import Fraction
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import sys

SOURCE_COMMIT = "1ee48a5383db71227773e54bfce92e1d7ff1cf32"
SOURCE_TREE = "8122e5019d4019f294bb643e3523c5ce9754a1e2"
SHARDS, UPDATES, ROUTE_FRAMES, FPS = 20, 6884, 3442, 30
HOLD_FRAMES, FINAL_FRAMES, POSITION_TOLERANCE = 60, 3562, 1e-6
WIDTH, HEIGHT = 1280, 800


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite_number(value, label):
    require(type(value) in (int, float) and math.isfinite(value), f"{label}: expected finite number")
    return float(value)


def exact(value, expected, label):
    # Python considers True == 1, which is inappropriate for evidence counts.
    require(type(value) is type(expected) and value == expected,
            f"{label}: expected {expected!r}, got {value!r}")


def equal_payload(left, right, label, *, continuous=False):
    """Only pose components use tolerance. Counts, schema and names stay exact."""
    if isinstance(left, dict):
        require(isinstance(right, dict) and left.keys() == right.keys(), f"{label}: keys differ")
        for key in left:
            equal_payload(left[key], right[key], f"{label}.{key}",
                          continuous=continuous or key in {"player", "cargo", "position", "quaternion", "portals", "portalPositions"})
    elif isinstance(left, list):
        require(isinstance(right, list) and len(left) == len(right), f"{label}: list length differs")
        for index, (a, b) in enumerate(zip(left, right)):
            equal_payload(a, b, f"{label}[{index}]", continuous=continuous)
    elif continuous and type(left) in (int, float):
        a, b = finite_number(left, label), finite_number(right, label)
        require(abs(a-b) <= POSITION_TOLERANCE,
                f"{label}: position delta {abs(a-b):.12g} exceeds {POSITION_TOLERANCE}")
    else:
        exact(right, left, label)


def vector3(value, label):
    require(isinstance(value, list) and len(value) == 3, f"{label}: expected xyz vector")
    for index, component in enumerate(value):
        finite_number(component, f"{label}[{index}]")


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024*1024), b""):
            result.update(chunk)
    return result.hexdigest()


def probe(path, expected_frames):
    completed = subprocess.run([
        os.environ.get("FFPROBE_PATH", "ffprobe"), "-v", "error", "-count_frames",
        "-show_streams", "-show_format", "-show_data_hash", "sha256", "-of", "json", str(path)
    ], check=True, capture_output=True, text=True)
    result = json.loads(completed.stdout)
    streams = result.get("streams", [])
    require(len(streams) == 1 and streams[0].get("codec_type") == "video",
            f"{path}: expected exactly one video stream and no audio")
    stream = streams[0]
    for key, value in {"codec_name":"h264", "pix_fmt":"yuv420p", "width":WIDTH, "height":HEIGHT}.items():
        exact(stream.get(key), value, f"{path}: {key}")
    for key in ("r_frame_rate", "avg_frame_rate"):
        require(Fraction(stream[key]) == FPS, f"{path}: {key} must be exactly {FPS} fps")
    require(int(stream["nb_frames"]) == expected_frames, f"{path}: incorrect declared frame count")
    require(int(stream["nb_read_frames"]) == expected_frames, f"{path}: incorrect decoded frame count")
    duration = finite_number(float(result["format"]["duration"]), str(path)+" duration")
    require(abs(duration-expected_frames/FPS) <= .002, f"{path}: duration differs from frame count")
    require(abs(float(stream.get("start_time", "0"))) <= .000001, f"{path}: video must begin at time zero")
    signature = {key: stream.get(key) for key in (
        "codec_name", "codec_tag_string", "profile", "level", "width", "height", "pix_fmt",
        "sample_aspect_ratio", "r_frame_rate", "time_base", "has_b_frames", "extradata_hash")}
    require(bool(signature["extradata_hash"]), f"{path}: missing codec parameter hash")
    return {"frames":expected_frames, "duration":duration, "bytes":path.stat().st_size,
            "sha256":digest(path), "codecSignature":signature}


def assert_faststart(path):
    # Verify top-level MP4 atom order instead of trusting the encoder flag alone.
    atoms = []
    with path.open("rb") as source:
        total = path.stat().st_size
        offset = 0
        while offset < total:
            source.seek(offset)
            header = source.read(8)
            require(len(header) == 8, "Truncated MP4 atom header")
            size, name = struct.unpack(">I4s", header)
            header_size = 8
            if size == 1:
                extended = source.read(8)
                require(len(extended) == 8, "Truncated extended MP4 atom header")
                size = struct.unpack(">Q", extended)[0]
                header_size = 16
            elif size == 0:
                size = total-offset
            require(size >= header_size and offset+size <= total, "Invalid MP4 atom size")
            atoms.append(name.decode("ascii", errors="replace"))
            offset += size
    require("moov" in atoms and "mdat" in atoms and atoms.index("moov") < atoms.index("mdat"),
            "MP4 metadata must precede video data for immediate browser playback")


def write_json(path, value):
    temporary = path.with_suffix(path.suffix+".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    temporary.replace(path)


def validate_report(report, shard, directory):
    label = f"shard {shard}"
    start, end = shard*ROUTE_FRAMES//SHARDS, (shard+1)*ROUTE_FRAMES//SHARDS
    count = end-start
    holds = HOLD_FRAMES*((shard == 0)+(shard == SHARDS-1))
    for key, expected in {
        "pass":True, "status":"complete", "sourceCommit":SOURCE_COMMIT, "sourceTree":SOURCE_TREE,
        "sourceWorkingTree":"", "visualTimeAtReset":0, "level":20, "width":WIDTH, "height":HEIGHT, "fps":FPS,
        "shard":shard, "shardCount":SHARDS, "expectedRouteUpdates":UPDATES,
        "expectedGlobalFrames":ROUTE_FRAMES, "routeFrames":count,
        "totalVideoFrames":count+holds, "simulationUpdates":UPDATES,
        "startHoldSeconds":2 if shard == 0 else 0,
        "endHoldSeconds":2 if shard == SHARDS-1 else 0,
    }.items():
        exact(report.get(key), expected, f"{label}.{key}")
    exact(report.get("browserErrors"), [], label+".browserErrors")
    equal_payload({"start":start,"endExclusive":end,"frames":count}, report.get("range"), label+".range")
    require(isinstance(report.get("recordingCommit"), str) and len(report["recordingCommit"]) == 40,
            label+": missing recording commit")
    route, final = report["route"], report["final"]
    for key, expected in {"pass":True,"level":20,"resets":0,"respawns":0,"frames":UPDATES}.items():
        exact(route.get(key), expected, f"{label}.route.{key}")
    for key, expected in {"state":"won","level":20,"updates":UPDATES,"frames":count}.items():
        exact(final.get(key), expected, f"{label}.final.{key}")
    for name in ("initial", "final"):
        for actor in ("player", "cargo"):
            vector3(report[name][actor], f"{label}.{name}.{actor}")
    milestones = route.get("milestones")
    require(isinstance(milestones, list) and len(milestones) > 0, label+": missing milestones")
    marks = report["marks"]
    require(len(marks) == len(milestones), label+": milestone stream count mismatch")
    previous_update = -1
    for index, (milestone, mark) in enumerate(zip(milestones, marks)):
        require(isinstance(milestone.get("name"), str) and bool(milestone["name"]), label+": invalid milestone name")
        for actor in ("player", "cargo"):
            vector3(milestone[actor], f"{label}.milestones[{index}].{actor}")
        for key in ("name", "player", "cargo", "teleports"):
            equal_payload({key:milestone[key]}, {key:mark[key]}, f"{label}.marks[{index}]")
        update = mark["update"]
        require(type(update) is int and previous_update <= update <= UPDATES,
                label+": out-of-order milestone update")
        previous_update = update
        global_frames = (update+1)//2
        exact(mark["globalCaptureFrames"], global_frames, label+": milestone global capture count")
        exact(mark["captureFrames"], max(0, min(end, global_frames)-start), label+": milestone local capture count")
        require(abs(finite_number(mark["videoSeconds"], label)- (2+update/60)) <= 1e-9,
                label+": incorrect milestone timestamp")
    exact(milestones[-1]["name"], "both at exit", label+": final milestone")
    indices = [i*ROUTE_FRAMES//SHARDS for i in range(SHARDS)] + [ROUTE_FRAMES-1]
    boundaries = report["boundaries"]
    exact([item["globalIndex"] for item in boundaries], indices, label+": shared boundaries")
    for item in boundaries:
        exact(item["update"], item["globalIndex"]*2+1, label+": boundary update")
        for actor in ("player", "cargo"):
            vector3(item[actor], label+": boundary "+actor)
        vector3(item["camera"]["position"], label+": camera position")
        require(len(item["camera"]["quaternion"]) == 4, label+": invalid camera quaternion")
        for component in item["camera"]["quaternion"]:
            finite_number(component, label+": camera quaternion")
    boundary_frames = report["boundaryFrames"]
    exact([item["kind"] for item in boundary_frames], ["first","last"], label+": endpoint images")
    exact([item["globalIndex"] for item in boundary_frames], [start,end-1], label+": endpoint indices")
    for frame in boundary_frames:
        exact(frame["update"], frame["globalIndex"]*2+1, label+": endpoint update")
        for actor in ("player", "cargo"):
            vector3(frame["state"][actor], label+": endpoint "+actor)
        filename = frame["file"]
        require(isinstance(filename, str) and Path(filename).name == filename, label+": invalid checkframe path")
        require((directory/"checkframes"/filename).is_file(), label+": missing endpoint checkframe")
        # Shared boundary snapshots are recorded before rendering; verify that
        # the actual first captured frame retains that same game/camera state.
        if frame["kind"] == "first" or shard == SHARDS-1:
            shared = next(item for item in boundaries if item["globalIndex"] == frame["globalIndex"])
            state = frame["state"]
            equal_payload({key:shared[key] for key in ("player","cargo","camera")},
                          {key:state[key] for key in ("player","cargo","camera")}, label+": rendered endpoint state")
            equal_payload({"portals":shared["portals"]}, {"portals":state["portalPositions"]}, label+": rendered portals")
    return count+holds


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("input"))
    parser.add_argument("--output", type=Path, default=Path("video"))
    args = parser.parse_args()
    input_dir, output_dir = args.input.resolve(), args.output.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir/"level-20-walkthrough.mp4"
    report_path = output_dir/"level20-video-report.json"
    temporary_video = output_dir/"level-20-walkthrough.assembling.mp4"
    summary = {"pass":False, "status":"validating", "sourceCommit":SOURCE_COMMIT,
        "sourceTree":SOURCE_TREE, "level":20, "shardCount":SHARDS,
        "width":WIDTH, "height":HEIGHT, "fps":FPS,
        "routeUpdates":UPDATES, "routeFrames":ROUTE_FRAMES,
        "startHoldFrames":HOLD_FRAMES, "endHoldFrames":HOLD_FRAMES,
        "expectedVideoFrames":FINAL_FRAMES, "expectedDurationSeconds":FINAL_FRAMES/FPS,
        "positionTolerance":POSITION_TOLERANCE,
        "method":"Every 30 fps global frame of the same complete ordinary route, rendered across twenty identical full-route replays and concatenated without re-encoding or omitted frames.",
        "audio":"No audio track: deterministic offline simulation capture.",
        "startedAt":datetime.now(timezone.utc).isoformat(), "parts":[]}
    try:
        require(not output_path.exists(), "Refusing to overwrite an existing finished walkthrough")
        directories = sorted(p.name for p in input_dir.glob("level20-part-*"))
        require(directories == sorted(f"level20-part-{i}" for i in range(SHARDS)),
                "Expected exactly the twenty numbered capture artifact folders")
        reference = None
        codec_signature = None
        parts = []
        total_frames = 0
        for shard in range(SHARDS):
            directory = input_dir/f"level20-part-{shard}"
            source_report = directory/"level20-record-report.json"
            video_path = directory/"level-20-walkthrough.mp4"
            report = json.loads(source_report.read_text(encoding="utf-8"))
            expected_frames = validate_report(report, shard, directory)
            if reference is None:
                reference = report
            else:
                exact(report["recordingCommit"], reference["recordingCommit"], f"shard {shard}: recording commit")
                equal_payload(reference["route"], report["route"], f"shard {shard}: complete route")
                equal_payload(reference["initial"], report["initial"], f"shard {shard}: initial state")
                equal_payload({k:v for k,v in reference["final"].items() if k != "frames"},
                              {k:v for k,v in report["final"].items() if k != "frames"}, f"shard {shard}: final state")
                normalized_marks = lambda value: [{k:v for k,v in item.items() if k != "captureFrames"} for item in value]
                equal_payload(normalized_marks(reference["marks"]), normalized_marks(report["marks"]),
                              f"shard {shard}: milestone timeline")
                equal_payload(reference["boundaries"], report["boundaries"], f"shard {shard}: all shared boundaries")
            video = probe(video_path, expected_frames)
            if codec_signature is None:
                codec_signature = video["codecSignature"]
            else:
                equal_payload(codec_signature, video["codecSignature"], f"shard {shard}: codec parameters")
            for key, actual_key in (("bytes","bytes"),("frames","frames")):
                exact(report["video"][key], video[actual_key], f"shard {shard}: reported video {key}")
            total_frames += expected_frames
            parts.append(video_path)
            summary["parts"].append({"shard":shard,"range":report["range"],
                "recordingReportSha256":digest(source_report),"video":video})
            print(json.dumps({"validatedShard":shard,"frames":expected_frames}), flush=True)
        exact(total_frames, FINAL_FRAMES, "Total video frames")
        summary["recordingCommit"] = reference["recordingCommit"]
        summary["route"] = reference["route"]
        summary["milestones"] = [{k:v for k,v in mark.items() if k != "captureFrames"} for mark in reference["marks"]]
        summary["sharedBoundarySamplesPerReplay"] = len(reference["boundaries"])
        summary["allReplaysMatched"] = True
        summary["status"] = "assembling"
        write_json(report_path, summary)
        # ffconcat uses its own single-quote syntax. Subprocess arguments do not
        # pass through a shell, and artifact paths may safely include spaces.
        quote = lambda value: "'"+str(value).replace("'", "'\\''")+"'"
        concat_path = output_dir/"level20-concat.txt"
        concat_path.write_text("ffconcat version 1.0\n"+"".join("file "+quote(part)+"\nduration "+format(item["video"]["frames"]/FPS, ".12f")+"\n" for part,item in zip(parts,summary["parts"])), encoding="utf-8")
        completed = subprocess.run([
            os.environ.get("FFMPEG_PATH", "ffmpeg"), "-hide_banner", "-loglevel", "warning", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat_path), "-map", "0:v:0",
            "-an", "-c", "copy", "-movflags", "+faststart", str(temporary_video)
        ], check=True, capture_output=True, text=True)
        summary["ffmpegWarnings"] = completed.stderr
        final_video = probe(temporary_video, FINAL_FRAMES)
        equal_payload(codec_signature, final_video["codecSignature"], "Final codec parameters")
        assert_faststart(temporary_video)
        temporary_video.replace(output_path)
        concat_path.unlink()
        summary.update({"pass":True,"status":"complete","video":final_video,
            "output":output_path.name,"fastStartVerified":True,
            "completedAt":datetime.now(timezone.utc).isoformat()})
        write_json(report_path, summary)
        print(json.dumps({"pass":True,"output":str(output_path),"video":final_video}), flush=True)
    except Exception as error:
        summary.update({"pass":False,"status":"failed","error":str(error)})
        write_json(report_path, summary)
        temporary_video.unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    main()
