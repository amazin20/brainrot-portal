"""Validate the actual sampled WebGL movie, without cutting or padding it."""
import hashlib, io, json, os, pathlib, subprocess, zipfile

root = pathlib.Path(os.environ['RUNNER_TEMP']) / 'castle-grand-movie-evidence'
out = pathlib.Path('docs/development/proofs/castle-grand-20261028/movie')
manifest = json.loads((root / 'manifest.json').read_text())
item = manifest['artifact']
source = '92d02d1d7febfe9162c08912f6728e459403f8af'
assert manifest['gameCommit'] == source
blob = (root / 'movie.zip').read_bytes()
assert len(blob) == item['bytes'] and hashlib.sha256(blob).hexdigest() == item['sha256']
out.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(io.BytesIO(blob)) as archive:
    for name in archive.namelist():
        p = pathlib.PurePosixPath(name)
        assert not p.is_absolute() and '..' not in p.parts
    report = json.loads(archive.read('report.json'))
    assert report['pass'] and report['sourceCommit'] == source
    assert report['fps'] == 6 and report['width'] == 960 and report['height'] == 540
    assert report['errors'] == report['consoleErrors'] == []
    result = report['result']
    route = result['route']
    assert result['state'] == 'won' and result['sameOriginal'] and route['pass']
    assert route['resets'] == route['respawns'] == route['cargoResets'] == result['deletions'] == 0
    assert route['metrics']['completedStages'] == route['metrics']['totalStages'] == 12
    assert route['metrics']['checkpoints'] is False
    assert route['seconds'] >= 900 and route['activeSeconds'] >= 900
    assert route['maxIdleSeconds'] < 20
    assert archive.read('source-sha.txt').decode().strip() == source
    frames = [json.loads(line) for line in archive.read('frames.jsonl').decode().splitlines()]
    assert len(frames) == report['frames']
    assert frames[0]['visualFrame'] == -1 and frames[0]['steps'] == frames[0]['seconds'] == 0
    assert frames[0]['state'] == 'playing' and frames[0]['solved'] == []
    assert frames[-1]['state'] == 'won' and len(frames[-1]['solved']) == 12
    assert frames[-1]['steps'] == route['physicsSteps'] and frames[-1]['visualFrame'] == route['frames'] - 1
    for i, frame in enumerate(frames):
        assert frame['videoFrame'] == i and frame['bytes'] > 10000 and len(frame['sha256']) == 64
        assert abs(frame['seconds'] - frame['steps'] / 120) < .001
        if i:
            prior = frames[i - 1]
            delta = frame['visualFrame'] - prior['visualFrame']
            assert 0 < delta <= 10
            assert frame['steps'] - prior['steps'] in [delta * 2, delta * 2 - 1]
            assert frame['seconds'] > prior['seconds']
            if i < len(frames) - 1:
                assert delta == 10 and frame['state'] == 'playing'
    movie = archive.read('castle-ordinary-route.mp4')
    assert len(movie) == report['video']['bytes'] and hashlib.sha256(movie).hexdigest() == report['video']['sha256']
    assert 1000000 < len(movie) < 95000000
    filenames = ['castle-ordinary-route.mp4', 'report.json', 'frames.jsonl', 'encoder.log',
                 'encoder-version.txt', 'probe-version.txt', 'source-sha.txt', 'observer-sha.txt',
                 'build-sha256.txt', 'server.log']
    for filename in filenames:
        (out / filename).write_bytes(archive.read(filename))

probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'stream=width,height,r_frame_rate,nb_frames,duration', '-of', 'json',
                        str(out / 'castle-ordinary-route.mp4')], check=True, capture_output=True, text=True)
stream = json.loads(probe.stdout)['streams'][0]
assert stream['width'] == 960 and stream['height'] == 540 and stream['r_frame_rate'] == '6/1'
assert int(stream['nb_frames']) == len(frames)
assert abs(float(stream['duration']) - route['seconds']) < 2 / 6 + .02
# Decode every video frame rather than trusting only a valid container header.
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(out / 'castle-ordinary-route.mp4'),
                '-f', 'null', '-'], check=True)
summary = {'gameCommit': source, 'observerCommit': manifest['observerCommit'], 'run': manifest['run'],
           'recordedFrames': len(frames), 'video': stream,
           'videoSha256': hashlib.sha256(movie).hexdigest(), 'videoBytes': len(movie),
           'routeSeconds': route['seconds'], 'measuredMovingOrLookingSeconds': route['activeSeconds'],
           'longestStationaryNoLookSeconds': route['maxIdleSeconds'], 'mechanismsCompleted': 12,
           'resets': 0, 'respawns': 0, 'cargoResets': 0, 'pairDeletions': 0,
           'sameOriginal': True, 'everyVideoFrameDecoded': True,
           'continuousSimulationStepsVerified': True, 'publishedGame': False,
           'limits': ['Silent native capture sampled at six frames per simulated second, not real-device game FPS.',
                      'The scripted route is not a human speedrun or a proof of a minimum completion time.',
                      'Previously completed rooms are supplied only to admit the initially unfinished castle.',
                      'No new rooms or mechanisms are implied by the recording duration.']}
(out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
seconds = float(stream['duration'])
minutes, remaining = int(seconds // 60), int(round(seconds % 60))
if remaining == 60:
    minutes, remaining = minutes + 1, 0
text = f'''# Полная запись прохождения нового замка

[Открыть MP4 · {minutes}:{remaining:02d}](castle-ordinary-route.mp4)

Это настоящие кадры игры на исходнике `{source}`. Видео без звука, 960×540, шесть сохранённых кадров на секунду игрового времени. Частота записи не является показателем FPS игры. Видео не смонтировано из скриншотов контрольных точек: кадры снимались равномерно через каждые десять визуальных шагов, а весь физический процесс продолжался без пропуска шагов. Склеек, замедления и добавленного простоя нет.

В записи достигнута победа через все 12 существующих механизмов с исходным спутником. Ноль сбросов, возрождений и скрытых удалений портальной пары. Игровой маршрут занимает {route['seconds']:.2f} секунды; счётчик движения или вращения камеры отметил {route['activeSeconds']:.2f} секунды. Самый длинный интервал без движения и поворота — {route['maxIdleSeconds']:.2f} секунды. Это автоматический известный маршрут, не человеческий спидран и не доказательство минимального времени прохождения.

Все видеокадры декодированы. Число кадров и длительность проверены отдельно через ffprobe; непрерывная последовательность физических шагов сверена с журналом. MP4 сохранён без изменения байтов исходного артефакта.

[Сводка](summary.json) · [Полный отчёт](report.json) · [Журнал каждого сохранённого кадра](frames.jsonl) · [Источник и хеши](manifest.json)
'''
(out / 'README.md').write_text(text)
parent = out.parent / 'README.md'
body = parent.read_text()
link = f'\n[Полная запись прохождения · {minutes}:{remaining:02d} · MP4](movie/README.md).\n'
if 'movie/README.md' not in body:
    parent.write_text(body + link)
print('Verified original video bytes, every decoded frame and the continuous no-reset twelve-mechanism route')
