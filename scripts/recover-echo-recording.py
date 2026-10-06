"""Finish encoding a checksum-pinned capture; never invent lost route telemetry."""
from pathlib import Path
import hashlib, json, re, shutil, subprocess, sys, zipfile

SOURCE = 'f7a03ebd2b0c32a03fd953fe547664037b4c3483'
ARCHIVE_HASH = 'c8f44bd6be80ce60fd7400f0751037ec6901d2372daa8329327cc46edb82eb81'
archive = Path(sys.argv[1])
out = Path(sys.argv[2]).resolve()
assert hashlib.sha256(archive.read_bytes()).hexdigest() == ARCHIVE_HASH
out.mkdir(parents=True, exist_ok=True)
frames = out / 'level-51-frames'
frames.mkdir(exist_ok=False)
expected = {f'level-51-frames/{i:06d}.jpg' for i in range(335)}
with zipfile.ZipFile(archive) as z:
    assert len(z.namelist()) == 335 and set(z.namelist()) == expected
    for name in sorted(expected):
        content = z.read(name)
        assert content.startswith(b'\xff\xd8') and content.endswith(b'\xff\xd9')
        (frames / Path(name).name).write_bytes(content)

def run(args):
    return subprocess.check_output(args, text=True, timeout=180)

pixel_log = out / 'native-pixels.txt'
assert re.fullmatch(r'[A-Za-z0-9_./-]+', str(pixel_log))
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-framerate', '12', '-i', str(frames / '%06d.jpg'),
     '-vf', f'scale=160:90,signalstats,metadata=mode=print:file={pixel_log}', '-f', 'null', '-'])
text = pixel_log.read_text()
minimum = [int(x) for x in re.findall(r'lavfi\.signalstats\.YMIN=(\d+)', text)]
maximum = [int(x) for x in re.findall(r'lavfi\.signalstats\.YMAX=(\d+)', text)]
assert len(minimum) == len(maximum) == 335
ranges = [hi - lo for lo, hi in zip(minimum, maximum)]
assert min(ranges) > 12
movie = out / 'level-51.mp4'
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '12', '-i', str(frames / '%06d.jpg'),
     '-frames:v', '335', '-c:v', 'libx264', '-preset', 'fast', '-crf', '27', '-pix_fmt', 'yuv420p',
     '-movflags', '+faststart', '-threads', '2', '-an', str(movie)])
probe = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                       'stream=codec_name,width,height,avg_frame_rate,nb_frames,duration',
                       '-show_entries', 'format=duration,size', '-of', 'json', str(movie)]))
s = probe['streams'][0]
assert s['codec_name'] == 'h264' and (s['width'], s['height']) == (854, 480)
assert int(s['nb_frames']) == 335 and s['avg_frame_rate'] == '12/1'
assert abs(float(probe['format']['duration']) - 335 / 12) < .1
shutil.copyfile(frames / '000000.jpg', out / 'level-51.jpg')
shutil.copyfile(frames / '000334.jpg', out / 'level-51-finish.jpg')
receipt = {
    'level': 51, 'title': 'Эхо горизонта', 'edition': 'foundation', 'sourceCommit': SOURCE,
    'frameCount': 335, 'fps': 12, 'width': 854, 'height': 480, 'durationSeconds': 335 / 12,
    'continuous': True,
    'routeSummary': {'pass': True, 'level': 51, 'resets': 0, 'respawns': 0, 'lastState': 'won'},
    'routeSummaryBasis': 'Recovered from successful assertions before the first FFmpeg invocation at line122 of the immutable original recorder. The original run then failed only because FFmpeg was missing.',
    'fullRouteTelemetryAvailable': False, 'milestonesAvailable': False,
    'recovery': {'originalRun': 37428403829, 'originalJob': 112154196808, 'rawFrameArtifact': 11395514996,
                 'rawFrameArchiveSHA256': ARCHIVE_HASH, 'originalRecordingJobConclusion': 'failure',
                 'failure': 'spawnSync ffmpeg ENOENT',
                 'recorderBlobSHA': 'f875e1fa3ca8f35c615ca8a0411c144571035d3e',
                 'newCapturePerformed': False, 'framesAddedDroppedOrReordered': False,
                 'nativeFramesManifest': [{'name': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(frames.iterdir())]},
    'pixelCheck': {'frames': 335, 'allNonblank': True, 'minimumLuminanceRange': min(ranges),
                   'method': 'Every actual JPEG decoded by FFmpeg at 160x90; YMAX-YMIN > 12'},
    'sha256': hashlib.sha256(movie.read_bytes()).hexdigest(), 'bytes': movie.stat().st_size,
    'video': 'level-51.mp4', 'poster': 'level-51.jpg', 'finishPoster': 'level-51-finish.jpg',
    'method': 'Previously captured production WebGL frames, ordinary input-only scripted route; normal third-person camera. Silent 12fps simulation-time recording; not hardware FPS or a human playtest. Encoding recovery only; original detailed telemetry was not retained.'
}
(out / 'level-51.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: receipt[k] for k in ['sourceCommit', 'frameCount', 'durationSeconds', 'sha256', 'bytes']}, indent=2))
