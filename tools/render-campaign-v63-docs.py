"""Render derived v63 docs/catalog only after a Root-issued Public acceptance.

No network, Git mutation, build, browser, or acceptance receipt is performed.
The output directory contains exactly four derived repository files. The Root
Public receipt remains an external, immutable input and is never emitted here.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import tempfile

REPO='amazin20/brainrot-portal'
SITE='https://amazin20.github.io/brainrot-portal/'
PREFIX='campaign-v63/'
URL=SITE+PREFIX
VERSION='v63-player-access-optics'
RESET_SCOPE=('reported journey counters after legacy fixture initialization; '
             'the initial fixture reset is outside these counters; specialized '
             'drivers retain their own stricter proofs')
README_BLOB='d312ad897f03f8618108aceb6a4e6cb7bffa6f09'
README_SHA256='49012aa9d53094ecad4950d270839a40a8c10fedbdbb05cd5a43d01417b9ba6e'
BASELINE_SHA256='e5d36ae12354ec7fea8c86a187d5a044fdf29ecec669789b8fe85b9f12c17994'
BASELINE_SUMMARY={'files':2605,'bytes':690702631,'inventorySha256':'2ecbf5a2b61c5b0fd8366f833c6670672f3447a16db3fd36464088291421190e'}
OUTPUTS={'README.md','tools/campaign-v63-public-files.json',
         'docs/campaign-v63-public-acceptance.md','docs/campaign-v63-public-protocol.md'}
INPUT_NAMES=('root_public','source_root','draft','preparation','final_proof','release_config','baseline_catalog','original_readme')

def require(value,message):
    if not value:raise ValueError(message)

def sha(value):return hashlib.sha256(value).hexdigest()
def encoded(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def serialized(value):return json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False).encode()+b'\n'
def git_blob(value):return hashlib.sha1(b'blob '+str(len(value)).encode()+b'\0'+value).hexdigest()

def parse_json(raw):
    require(type(raw) is bytes and 0<len(raw)<=25_000_000,'Invalid JSON byte budget')
    def pairs(items):
        result={}
        for key,value in items:
            require(key not in result,'Duplicate JSON key: '+key);result[key]=value
        return result
    def bad(value):raise ValueError('Nonfinite JSON: '+value)
    def finite(value):
        result=float(value);require(math.isfinite(result),'Nonfinite JSON number');return result
    return json.loads(raw.decode('utf-8'),object_pairs_hook=pairs,parse_constant=bad,parse_float=finite)

def positive(value,label):require(type(value) is int and 0<value<2**53,label+' must be a positive safe integer');return value
def digest(value,length=64):require(type(value) is str and re.fullmatch('[0-9a-f]{'+str(length)+'}',value),'Invalid immutable hash');return value
def safe_name(value):
    require(type(value) is str and value and not value.startswith('/') and '\\' not in value
            and not re.match(r'^[A-Za-z]:',value) and all(p not in ('','.','..') for p in value.split('/'))
            and all(ord(c)>=32 and ord(c)!=127 for c in value),'Unsafe inventory path');return value

def inventory(rows,limit=800_000_000):
    require(type(rows) is list and 0<len(rows)<=10000,'Invalid inventory')
    names=[];total=0
    for row in rows:
        require(type(row) is dict and set(row)=={'path','bytes','sha256'},'Invalid inventory row')
        names.append(safe_name(row['path']));require(type(row['bytes']) is int and 0<=row['bytes']<=limit,'Invalid file size')
        digest(row['sha256']);total+=row['bytes']
    require(names==sorted(set(names)) and total<=limit,'Unsorted, duplicate or oversized inventory')
    known=set(names)
    require(not any('/'.join(name.split('/')[:i]) in known for name in names for i in range(1,len(name.split('/')))),'File/directory collision')
    return rows

def summary(rows):
    inventory(rows)
    return {'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'inventorySha256':sha(encoded(rows))}

def unchanged_append(baseline,candidate,union):
    inventory(baseline);inventory(candidate,100_000_000);inventory(union)
    require(not any(r['path'].startswith(PREFIX) for r in baseline),'Baseline already contains v63')
    provenance=[r for r in union if r['path']==PREFIX+'publication-provenance.json']
    require(len(provenance)==1,'Exactly one actual provenance file required')
    expected=sorted(baseline+[dict(r,path=PREFIX+r['path']) for r in candidate]+provenance,key=lambda r:r['path'])
    require(union==expected,'Historical bytes or exact candidate append changed')
    return summary(union)

def require_scope_false(value):
    for key in ('masterTzAccepted','liveSdkAccepted','moderationAccepted','physicalPhonePerformanceAccepted','humanPlaytest','hardwareFPSMeasured'):
        if key in value:require(value[key] is False,'Unsupported acceptance scope: '+key)

def validate_inputs(raw):
    require(set(raw)==set(INPUT_NAMES),'Every actual Root/evidence/README input is required')
    data={name:parse_json(value) for name,value in raw.items() if name!='original_readme'}
    root,source,draft,state,final,config,baseline=(data[name] for name in INPUT_NAMES[:-1])
    require(root.get('kind')=='root-independent-v63-public-acceptance' and root.get('pass') is True
            and root.get('sourceAccepted') is True and root.get('publicationAccepted') is True,
            'A Root-issued actual Public acceptance is required; drafts are ineligible')
    require(source.get('kind')=='root-independent-v63-source-acceptance' and source.get('pass') is True
            and source.get('sourceAccepted') is True and source.get('publicationAccepted') is False,'Actual accepted Root Source receipt required')
    require(draft.get('kind')=='draft-v63-public-terminal-evidence-audit' and draft.get('pass') is True
            and draft.get('sourceAccepted') is False and draft.get('publicationAccepted') is False,'Unchanged successful unaccepted Public audit draft required')
    require_scope_false(root);require_scope_false(source)
    require(config['frozen'] is True and config['publicationAccepted'] is False and config['repository']==REPO
            and config['namespace']==PREFIX and config['version']==VERSION,'Wrong frozen release configuration')
    for value in (root,source,draft):
        digest(value['sourceCommit'],40);digest(value['sourceTree'],40)
        require(value['sourceCommit']==config['sourceCommit'] and value['sourceTree']==config['sourceTree'],'Source identity differs')
        require(value['sourceReview']=={'runId':config['sourceRun'],'runAttempt':config['sourceAttempt']},'Source run/attempt differs')
    require(source['run']==config['sourceRun'] and source['runAttempt']==config['sourceAttempt'],'Source receipt run differs')
    require(sha(raw['source_root'])==config['sourceAcceptance']['sha256'],'Root Source receipt hash differs from frozen config')
    require(draft['config']=={'path':'tools/campaign-v63-release.json','bytes':len(raw['release_config']),'sha256':sha(raw['release_config'])},'Draft config binding differs')
    require(root['publisherCommit']==draft['publisherCommit'] and root['publisherTree']==draft['publisherTree'],'Publisher identity differs')
    digest(root['publisherCommit'],40);digest(root['publisherTree'],40)
    require(root['publicReview']==draft['publicReview'],'Public run/attempt differs')
    review=root['publicReview'];positive(review['runId'],'Public run');positive(review['runAttempt'],'Public attempt')
    producer={'GITHUB_REPOSITORY':REPO,'GITHUB_SHA':root['publisherCommit'],'GITHUB_RUN_ID':str(review['runId']),'GITHUB_RUN_ATTEMPT':str(review['runAttempt'])}
    require(state['producer']==final['producer']==producer,'Preparation/final producer differs')
    require(state['publicationAccepted'] is False and final['publicationAccepted'] is False
            and final['technicalChecksPassed'] is True and final['requiresIndependentRootAcceptance'] is True,'Original CI proof flags changed')
    require(final['sourceCommit']==config['sourceCommit'] and final['sourceTree']==config['sourceTree']
            and final['sourceReview']==source['sourceReview'],'Final proof Source binding differs')
    require(state['configSha256']==sha(raw['release_config']),'Preparation configuration changed')
    pin=root['independentAudit'];require(pin['draftBytes']==len(raw['draft']) and pin['draftSha256']==sha(raw['draft']),'Root did not bind this exact successful Public draft')
    actual_bindings={'preparationSha256':sha(raw['preparation']),'finalProofSha256':sha(raw['final_proof']),
                     'sourceAcceptanceSha256':sha(raw['source_root']),'releaseConfigSha256':sha(raw['release_config'])}
    require(root['evidenceBindings']==actual_bindings,'Root actual evidence digests differ')
    timestamp=root.get('acceptedAt',root.get('generatedAt'));require(type(timestamp) is str,'Root acceptance timestamp required')
    accepted_at=dt.datetime.fromisoformat(timestamp.replace('Z','+00:00'));require(accepted_at.tzinfo is not None,'Root acceptance time must have timezone')
    require(sha(raw['baseline_catalog'])==config['baselineCatalogSha256']==BASELINE_SHA256,'Accepted baseline catalog changed')
    require(baseline['publicationAccepted'] is True and baseline['sourceAccepted'] is True,'Accepted historical catalog required')
    old=inventory(baseline['siteFiles']);require(summary(old)==BASELINE_SUMMARY,'Historical baseline differs')
    candidate=inventory(source['candidateFiles'],100_000_000)
    require(summary(candidate)=={'files':len(candidate),'bytes':source['candidateBytes'],'inventorySha256':source['candidateInventorySha256']},'Accepted candidate inventory differs')
    require(state['candidateFiles']==candidate,'Preparation candidate differs from accepted Source')
    union=unchanged_append(old,candidate,state['unionFiles'])
    checks=draft['checks'];require(checks['pass'] is True and checks['auditPassed'] is True,'Public proof draft did not pass')
    require(checks['baseline']==BASELINE_SUMMARY and checks['candidate']==summary(candidate) and checks['union']==union,'Draft file union differs')
    require(final['originalDistInventorySha256']==source['candidateInventorySha256'] and final['unionInventorySha256']==union['inventorySha256'],'Final inventory digests differ')
    require(final['historicalFilesPreserved']==len(old) and final['historicalBytesPreserved']==BASELINE_SUMMARY['bytes'],'Final historical byte preservation differs')
    require(final['publicRooms']==list(range(1,52)) and checks['publicRooms']==51,'Public route coverage is incomplete')
    require(checks['publisher']=={'commit':root['publisherCommit'],'tree':root['publisherTree'],**review},'Draft publisher binding differs')
    require(checks['source']=={'commit':config['sourceCommit'],'tree':config['sourceTree'],**source['sourceReview']},'Draft Source binding differs')
    native=source['checks']['nativeRoutes'];require(native['normalUiZeroStepStartProven'] is False and native['resetCounterScope']==RESET_SCOPE,'Source legacy reset scope changed')
    require(final['nativeRouteScope']=={'normalUiZeroStepStartProven':False,'resetCounterScope':RESET_SCOPE},'Public legacy reset scope changed')
    provider=checks['provider'];require(provider['jobs']==11 and provider['artifacts']==12 and provider['rawJobLogs']==11
            and provider['downloadedArchives']==11,'Incomplete actual Public provider cohort')
    require(len(draft['publicArtifacts'])==11 and len(draft['publicLogs'])==11 and len(draft['metadataOnlyArtifacts'])==1,'Incomplete retained Public ZIP/log cohort')
    pages=draft['metadataOnlyArtifacts'][0]
    require(pages['artifactName']=='github-pages' and pages['metadataOnlyNotDownloaded'] is True and pages['bytesNotRead'] is True
            and pages['zipDigestIndependentlyRecomputed'] is False and pages['archiveCRCOrInventoryVerified'] is False,'Pages ZIP limitation changed')
    deployment=final['deployment']['deployment'];statuses=final['deployment']['statuses'];require(statuses and statuses[0]['state']=='success','Canonical final CI deployment did not succeed')
    require(deployment['sha']==root['publisherCommit'] and deployment['environment']=='github-pages','Deployment belongs to another publisher/environment')
    positive(deployment['id'],'Deployment ID');deployment_audit=checks['deployment']
    require(deployment_audit['deploymentId']==deployment['id'] and deployment_audit['independentPostCIDeploymentGet'] is False
            and deployment_audit['workflowRetainedOriginalAPIBytes'] is True,'Canonical CI snapshot scope changed')
    run_url='https://github.com/'+REPO+'/actions/runs/'+str(review['runId'])
    require(any(isinstance(statuses[0].get(k),str) and (statuses[0][k].rstrip('/')==run_url or statuses[0][k].startswith(run_url+'/')) for k in ('log_url','target_url')),'Deployment is not owned by the accepted Public run')
    recovery=checks.get('recovery')
    if 'recovery' in config:
        origin=config['recovery'];require(type(recovery) is dict and recovery['kind']==origin['kind']
                and recovery['originalAttemptEligible'] is False and recovery['originalPublicAcceptance'] is False
                and recovery['identicalUnionConfirmed'] is True,'Failed first attempt must remain ineligible')
        original={'GITHUB_REPOSITORY':REPO,'GITHUB_SHA':origin['publisherCommit'],
                  'GITHUB_RUN_ID':str(origin['runId']),'GITHUB_RUN_ATTEMPT':str(origin['runAttempt'])}
        require(recovery['originalProducer']==original and root.get('recovery')==recovery,'Root recovery lineage differs')
        require(original!=producer and original['GITHUB_SHA']!=producer['GITHUB_SHA']
                and original['GITHUB_RUN_ID']!=producer['GITHUB_RUN_ID'],'Failed publisher/run cannot become the accepted recovery')
        require(state['recovery']==final['recovery'] and state['recovery']['originalProducer']==original
                and state['recovery']['previousDeployment']==origin['deployment']==recovery['previousDeployment'],
                'Recovery retained material/deployment lease differs')
        require(origin['union']==union and recovery['originalProvenance']==origin['provenance']
                and origin['provenance'] in state['unionFiles'],'Recovery rewrote a prior published byte')
        require(deployment['id']>origin['deployment']['id'],'Recovery needs its own newer deployment')
    else:
        require(recovery is None and root.get('recovery') is None,'Unexpected recovery lineage')
    require(len(raw['original_readme'])==45667 and sha(raw['original_readme'])==README_SHA256 and git_blob(raw['original_readme'])==README_BLOB,'Original authenticated README changed')
    return {'raw':raw,'root':root,'source':source,'draft':draft,'state':state,'final':final,'config':config,'baseline':baseline,
            'candidate':summary(candidate),'union':union,'timestamp':timestamp,'deployment':deployment,
            'recovery':recovery,
            'inputDigests':{name:{'bytes':len(value),'sha256':sha(value)} for name,value in raw.items()}}

def number(value):return f'{value:,}'.replace(',',' ')
def run_link(value):return f'https://github.com/{REPO}/actions/runs/{value}'
def prose_spacing(value):
    # Apply only to newly rendered prose, never to the retained README history.
    return re.sub(r'([А-Яа-яЁё])(?=\d)',r'\1 ',value)

def recovery_note(c):
    if c['recovery'] is None:return ''
    origin=c['config']['recovery']
    return (f"Первая PUBLIC-попытка [{origin['runId']}/{origin['runAttempt']}]({run_link(origin['runId'])}) "
            'завершилась ошибкой внешнего наблюдателя при подготовке мобильного окна и не принята. '
            'Исправлен Main-наблюдатель и добавлена проверка повторной публикации; принятый Source не менялся. '
            f"Новый полный PUBLIC-прогон и новый deployment повторно публикуют все{c['union']['files']} файлов без изменения ни одного байта. "
            f"Исходный `publication-provenance.json` сохраняет producer `{origin['publisherCommit']}` "
            'первой поставки; текущие preparation/final/Root-квитанция отдельно указывают новый publisher/run.\n\n')

def common_limits():
    return ('Замок содержит 12 проверенных механизмов и завершает кампанию под номером51 '
            '(постоянный ID41). **500 содержательных уникальных этапов и минимум15 минут '
            'человеческого спидрана остаются открытыми.** Человеческое открытие решений, '
            'аппаратный FPS и производительность реального телефона, все возможные обходы, '
            'ракурсы и переходы ориентации не приняты. Для комнаты17 остаются открытыми '
            'портретное кадрирование и читаемость при мгновенном изменении экрана. '
            'Живая выдача рекламы, кабинет Яндекс Игр и модерация не проверены.')

def readme_section(context):
    s=context['source'];p=context['root'];sc=s['checks'];pc=context['draft']['checks'];union=context['union'];pr=p['publicReview'];sr=s['sourceReview']
    return f'''## Кампания v63: постепенное открытие, подсказки и оптика

**[Играть в v63]({URL})** · [Проверка и границы](docs/campaign-v63-public-acceptance.md) · [Протокол](docs/campaign-v63-public-protocol.md) · [Точный штамп]({URL}build-info.json)

Новый игрок начинает с первой комнаты. После победы открывается следующая; пройденные комнаты доступны для повторения. Прямая ссылка и скрытый выбор закрытого уровня не обходят карту. Вместо длинного списка по Escape — компактная пауза и переход к карте; возврат сохраняет ту же комнату и спутника. Для каждой из51 комнат есть три авторские подсказки. В сборке Яндекс Игр следующий намёк открывает только подтверждённый `onRewarded`; закрытие и ошибка рекламы награды не дают, открытые подсказки можно перечитывать. В GitHub-демо реклама отсутствует, что прямо указано в интерфейсе.

В комнате36 запросы портала и камеры используют текущую позу собственного физического ротора. В комнатах35 и39 обновлены корпуса приёмников и движущиеся створки с индикацией реального состояния. Исходные актёры, 59 GLB и механизмы головоломок сохранены.

[SOURCE]({run_link(sr['runId'])}): **{sc['provider']['jobs']} задания, {sc['provider']['artifacts']} ZIP, {number(sc['cpu']['tests'])} CPU-тестов**, 51 CPU-победа и51 consumer WebGL-финиш. Оригинальный [GitHub-чекер](https://github.com/Nioris/yandex-games-debug-checker) проверен на всех51 review-маршрутах, десяти полных фильмах оптики и двух положительных production-SDK сценариях. Это явно обозначенные SDK mock-сценарии; исходные `WARN` и `NOT VERIFIED` сохранены. Проверены {sc['rewardedUI']['transactions']} реальные UI-транзакции подсказок с close/error/reward/reread, четыре фазы импорта v62 и управление телефона в390×844 и844×390.

[PUBLIC]({run_link(pr['runId'])}): **{pc['provider']['jobs']} заданий, {pc['provider']['artifacts']} артефактов**, {pc['publicRooms']} WebGL-финишей и проверка интерфейса настоящего опубликованного consumer-пакета. Полная CI HTTP-сверка охватывает **{number(union['files'])} файлов /{number(union['bytes'])} байт**, все прежние2605 файлов /690702631 байт сохранены. [PUBLIC Root](tools/campaign-v63-root-public-acceptance.json) · [Каталог](tools/campaign-v63-public-files.json). Deployment подтверждён оригинальным API-снимком финального CI; `independentPostCiDeploymentGet:false`. Большой `github-pages` ZIP проверен только по метаданным и исходному upload-журналу, без скачивания и независимого чтения его payload.

Для обычной/native когорты51 комнат сохраняется `normalUiZeroStepStartProven:false`: первоначальный legacy fixture-reset находится до отчётных journey counters. Это не непрерывное прохождение всех51 комнат новым игроком. Отдельные десять nativeStart-фильмов имеют собственные более строгие доказательства старта. Исторические видео перечитаны и хешированы в прежних версиях; это не новые записи или новое полное декодирование истории.

{recovery_note(context)}
{common_limits()}

'''

def update_readme(original,section):
    old=f'**[Актуальная кампания v62]({SITE}campaign-v62/)**'.encode()
    new=f'**[Актуальная кампания v63]({URL})**'.encode()
    marker='## Кампания v62: биосфера и узкие экраны комнаты 17'.encode()
    require(original.count(old)==1 and original.count(marker)==1,'Original README current-link/history anchors differ')
    changed=original.replace(old,new,1);at=changed.index(marker)
    output=changed[:at]+section.encode()+changed[at:]
    require(output[output.index(marker):]==original[original.index(marker):],'Historical README tail changed')
    require(output.count(marker)==1 and output.count(new)==1,'README current/history anchors duplicated')
    return output

def render_catalog(c):
    source,root,draft=c['source'],c['root'],c['draft'];public=root['publicReview'];source_review=source['sourceReview']
    return {'schemaVersion':1,'generatedAt':c['timestamp'],'sourceAccepted':True,'publicationAccepted':True,
            'sourceCommit':source['sourceCommit'],'sourceTree':source['sourceTree'],'sourceReview':source_review,
            'publisherCommit':root['publisherCommit'],'publisherTree':root['publisherTree'],
            'publicationRun':public['runId'],'publicationRunAttempt':public['runAttempt'],
            'siteUrl':SITE,'publicURL':URL,'siteFiles':c['state']['unionFiles'],
            'files':c['union']['files'],'bytes':c['union']['bytes'],'inventorySha256':c['union']['inventorySha256'],
            'baseline':BASELINE_SUMMARY,'candidate':c['candidate'],
            'rootPublicAcceptance':{'path':'tools/campaign-v63-root-public-acceptance.json',**c['inputDigests']['root_public']},
            'rootSourceAcceptance':{'path':'tools/campaign-v63-root-source-acceptance.json',**c['inputDigests']['source_root']},
            'releaseConfig':{'path':'tools/campaign-v63-release.json',**c['inputDigests']['release_config']},
            'evidenceBindings':root['evidenceBindings'],'deployment':{'id':c['deployment']['id'],'sha':c['deployment']['sha'],
                'canonicalFinalCiSnapshot':True,'independentPostCiDeploymentGet':False},
            'publicationRecovery':c['recovery'],
            'githubPagesArtifact':draft['metadataOnlyArtifacts'][0],
            'nativeRouteScope':{'normalUiZeroStepStartProven':False,'resetCounterScope':RESET_SCOPE},
            'masterTzAccepted':False,'liveSdkAccepted':False,'moderationAccepted':False,'physicalPhonePerformanceAccepted':False,
            'scope':'Derived from Root-issued actual Public acceptance and the exact retained CI union; no new HTTP, deployment GET, Pages ZIP read, build or acceptance issuance.',
            'limitations':['Historical files retain their original versions; HTTP hashes are not new recording/full-decode evidence.',
                'github-pages ZIP payload was not downloaded or independently inventoried.',
                'Ordinary/native51 initial legacy fixture reset is outside reported counters.',
                'No human discovery, physical-device FPS, live ad fill or moderation acceptance.']}

def acceptance_doc(c):
    s,p,d=c['source'],c['root'],c['draft'];sc=s['checks'];pc=d['checks'];r=p['publicReview'];sr=s['sourceReview'];outcomes=sc['playerAccess']['requestOutcomeCounts']
    return f'''# Кампания v63: фактическая техническая приёмка

**[Открыть принятую кампанию]({URL})** · [Root PUBLIC](../tools/campaign-v63-root-public-acceptance.json) · [Полный каталог](../tools/campaign-v63-public-files.json) · [Протокол](campaign-v63-public-protocol.md)

Принят точный технический выпуск `{VERSION}`. Root отдельно принял SOURCE и фактическую публикацию PUBLIC. Это не закрывает полное мастер-ТЗ.

| Связь | Зафиксированное значение |
| --- | --- |
| Source commit | `{s['sourceCommit']}` |
| Source tree | `{s['sourceTree']}` |
| Source CI | [{sr['runId']}/{sr['runAttempt']}]({run_link(sr['runId'])}) |
| Publisher commit | `{p['publisherCommit']}` |
| Publisher tree | `{p['publisherTree']}` |
| Public CI | [{r['runId']}/{r['runAttempt']}]({run_link(r['runId'])}) |
| Consumer-пакет | {c['candidate']['files']} файлов /{number(c['candidate']['bytes'])} байт |
| Полный публичный union | {c['union']['files']} файлов /{number(c['union']['bytes'])} байт |
| Canonical CI deployment | `{c['deployment']['id']}` / `{c['deployment']['sha']}` |

{recovery_note(c)}
## Изменения

Карта открывает первую незавершённую комнату и оставляет доступ к пройденным. Прямые будущие ссылки, параметры прежних review-редакций и подмена скрытого select не дают новому пользователю выбрать закрытую комнату. Замок остаётся последним, под номером51, постоянный ID41.

Для всех51 комнат доступны три авторских намёка. В Yandex-пакете разблокировку подтверждает только `onRewarded`, повторный callback не выдаёт вторую награду; close/error не открывают подсказку. Открытые намёки перечитываются без рекламы. На GitHub это честно обозначенный бесплатный demo-режим без SDK-рекламы.

Escape открывает компактную паузу со свёрнутыми настройками. Выбор комнаты переводит на карту Atlas; кнопка возврата и Escape продолжают ту же сцену с теми же телами и спутником. Настройки, прогресс и подсказки импортируются из целого v62-сохранения. Четыре фазы отдельно доказывают: начальное чтение без записи; обычные настройки; Play; reload. Исторический `resumeLevel:3` не переписывается при старте, а доступный запуск вычисляется как индекс2; Play сохраняет его только в private v63.

В комнате36 устранено устаревание query-позы ротора: запрос читает текущую позу принадлежащего механизму Cannon-тела. В комнатах35/39 обновлены изготовленные корпуса приёмников и створки с индикацией реального питания/состояния. Исходные механизмы, актёры и59 GLB сохранены.

## Что действительно проверено

SOURCE: {sc['provider']['jobs']} успешных заданий, {sc['provider']['artifacts']} исходных ZIP и {number(sc['cpu']['tests'])}/{number(sc['cpu']['passed'])} CPU-тестов в{sc['cpu']['disjointShards']} непересекающихся частях ({sc['cpu']['files']} файлов). Получены51 обычная CPU-победа,51 compiled consumer WebGL-победа с исходным спутником и20 balanced-снимков десяти комнат оптики.

Оригинальный неизменённый [чекер Nioris](https://github.com/Nioris/yandex-games-debug-checker) сохранён отдельно от consumer/production-игры. Его настоящие DOM-строки и исходный Copy-report проверены для51 review-маршрута, десяти полных native-фильмов комнат31–40 и положительных desktop/mobile сценариев production-пакета. `WARN` и `NOT VERIFIED` не повышались до PASS. SDK и реклама этих проверок — явно обозначенные mock-сценарии; это не официальная сертификация Яндекса.

Проверены {sc['rewardedUI']['transactions']} UI-транзакции подсказок на51 уровне: close/error/reward/duplicate/reread, остановка/возобновление игры и аудио. Подлинный production ZIP отдельно прошёл отрицательный сценарий rejected SDK и положительные desktop/mobile сценарии без QA-hooks. Отрицательные исходные выводы чекера не объявляются положительной приёмкой.

SOURCE UI содержит{sc['playerAccess']['actualBrowserResponses']} проверенных candidate HTTP-ответов: {outcomes['finishedWithCompleteVerifiedBody']} обычных завершений и{outcomes['abortedWithCompleteVerifiedBody']} случаев `net::ERR_ABORTED` **после полного независимо проверенного тела того же запроса**. Сопоставлены настоящий CDP request ID, ordinal и поколение документа. Ошибка без такого тела не принимается; новые GET или подставные байты не использованы.

PUBLIC: {pc['provider']['jobs']} успешных заданий, {pc['provider']['artifacts']} артефактов и{pc['provider']['rawJobLogs']} исходных журналов. Реальные public-страницы прошли gated Atlas, победу первой комнаты, Next/reload/replay, компактную паузу, возврат и миграцию. Все public-маршруты завершены исходным спутником; независимо декодированы{len(pc['decodedImages'])} снимков. Полная CI HTTP200-сверка длины/SHA256 охватывает{c['union']['files']} файлов/{c['union']['bytes']} байт и сохраняет все2605 исторических файлов/690702631 байт без изменений. Полный список находится в каталоге.

Большой `github-pages` ZIP не скачивался и не читался независимым Root-аудитом: его ID, размер и provider digest связаны с исходным успешным upload-журналом и deployment lease. Независимо скачаны и проверены остальные{pc['provider']['downloadedArchives']} ZIP, включая CRC и точный состав. Union подтверждён сохранённым CI HTTP-proof, а не пересчитан из неизвестного Pages payload.

Deployment подтверждён **каноническими исходными API-байтами финального CI**. `independentPostCiDeploymentGet:false`; нового независимого post-CI deployment/HTTP запроса и проверки текущего live-состояния эта документация не заявляет.

## Управление на телефоне

Слева — джойстик; движение пальцем справа поворачивает камеру. `①`/`②` выпускают порталы, `E` берёт друга или взаимодействует. Внизу справа — бег и прыжок, отдельно доступна пауза. Настоящие HTML-кнопки проверены в мобильной браузерной эмуляции390×844 и844×390; это не FPS-тест физического телефона.

## Границы доказательств

Для общей ordinary/native когорты51 комнат: `normalUiZeroStepStartProven:false`.

```text
{RESET_SCOPE}
```

Нулевые отчётные counters не включают первоначальный legacy fixture-reset и не означают непрерывное прохождение всей кампании от Play. Десять отдельных полных Optics nativeStart-фильмов сохраняют собственные более строгие проверки нулевого старта, идентичности и отсутствия сброса. Исторические фильмы сохраняют свои исходные версии; их HTTP-хеширование не является новой записью или новым полным декодированием.

{common_limits()}
'''

def protocol_doc(c):
    s,p,d=c['source'],c['root'],c['draft'];lines=[]
    for name,label in [('root_public','Root PUBLIC JSON'),('source_root','Root SOURCE JSON'),('draft','Независимый Public draft'),('preparation','Original preparation.json'),('final_proof','Original final-publication.json'),('release_config','Frozen release config'),('baseline_catalog','Accepted v62 catalog')]:
        row=c['inputDigests'][name];lines.append(f'| {label} | {row["bytes"]} | `{row["sha256"]}` |')
    return f'''# Протокол публикации и производных документов v63

Этот документ и каталог сгенерированы только после Root-issued PUBLIC acceptance. Генератор не делает запросов, не запускает игру, не пересобирает пакет, не пишет квитанции приёмки и не публикует сайт.

## Точные входные байты

| Вход | Байт | SHA256 |
| --- | ---: | --- |
{chr(10).join(lines)}

Source commit `{s['sourceCommit']}`, tree `{s['sourceTree']}`; Source run `{s['sourceReview']['runId']}/{s['sourceReview']['runAttempt']}`. Publisher `{p['publisherCommit']}`, tree `{p['publisherTree']}`; Public run `{p['publicReview']['runId']}/{p['publicReview']['runAttempt']}`.

{recovery_note(c)}
## Неизменяемая поставка

Consumer-байты перенесены из принятого Source-артефакта без пересборки и переписывания `build-info.json`. Исходный stamp остаётся `verified:false`; самостоятельная Root-приёмка хранится отдельно. Каталог содержит исходные preparation `unionFiles` и их точные размеры/SHA256.

| Набор | Файлов | Байт | Inventory SHA256 |
| --- | ---: | ---: | --- |
| Исторический baseline | {BASELINE_SUMMARY['files']} | {BASELINE_SUMMARY['bytes']} | `{BASELINE_SUMMARY['inventorySha256']}` |
| Принятый consumer | {c['candidate']['files']} | {c['candidate']['bytes']} | `{c['candidate']['inventorySha256']}` |
| Публичный union | {c['union']['files']} | {c['union']['bytes']} | `{c['union']['inventorySha256']}` |

Сохранён каждый прежний файл, включая root entry; новый canonical URL — `{URL}`. Добавлены только точный consumer-пакет в `campaign-v63/` и один `publication-provenance.json`. Производные README/docs/catalog не участвуют в Pages-пакете и не меняют принятые игровые байты.

Root проверил terminal API cohort, исходные журналы и provider-bound ZIP/CRC/closures. `github-pages` — **metadata-only, payload не скачан**; независимого перерасчёта ZIP SHA/CRC/union из этого payload нет. Этот предел сохраняется и в каталоге. Полная HTTP-сверка historical+new union — оригинальная CI-проверка, не новый post-CI GET.

## Участки с разной строгостью

Общие ordinary/native51 routes используют prior-prefix QA saves; текущая целевая комната в них ещё не пройдена. Сброс в начале legacy fixture находится вне последующих journey counters. Точный scope:

```text
{RESET_SCOPE}
```

Поэтому `normalUiZeroStepStartProven:false` для общей когорты. Отдельные десять continuous Optics nativeStart фильмов имеют собственный нормальный Play, нулевой шаг, исходные тела, покадровые/физические счётчики и полное декодирование каждого MP4. Это не доказательство слепого человеческого решения всех комнат.

Source UI разделяет успешный finished request и `net::ERR_ABORTED` с **полным проверенным телом того же actual CDP request**. Подтверждение включает ordinal, request ID, поколение документа, размер и SHA256; ошибка без такого тела остаётся ошибкой. Конечные drain проверяют отсутствие pending/inflight до навигации/закрытия. Durable CDP buffer хранит исходный браузерный ответ, не заменяет его новым запросом.

Consumer, отдельный review SDK package и настоящий production Yandex ZIP имеют собственные точные inventories, хотя связаны одним Source HEAD/sourceInputs. Их байты и контексты не объявляются одинаковыми. Оригинальный сторонний checker не поставляется в production-игре. Его WARN/NOT VERIFIED сохранены; mock SDK/reward callbacks не устанавливают живую выдачу рекламы или модерацию.

## Deployment snapshot

Принят canonical final-CI deployment `{c['deployment']['id']}` для `{c['deployment']['sha']}`. Независимый аудитор сверил исходные закрытые страницы API из финального CI и owning Public run. `independentPostCiDeploymentGet:false`; независимого нового запроса deployment после CI не выполнено. Это также не заявление о текущем live-состоянии после момента наблюдения.

## История и открытые требования

README обновлён из точного исходного blob `{README_BLOB}` ({45667} байт, SHA256 `{README_SHA256}`): заменена только ссылка актуальной кампании, новый раздел v63 вставлен перед v62. Весь исторический хвост от заголовка v62 сохранён байт-в-байт.

{common_limits()}
'''

def render(context):
    return {'README.md':update_readme(context['raw']['original_readme'],prose_spacing(readme_section(context))),
            'tools/campaign-v63-public-files.json':serialized(render_catalog(context)),
            'docs/campaign-v63-public-acceptance.md':prose_spacing(acceptance_doc(context)).encode(),
            'docs/campaign-v63-public-protocol.md':prose_spacing(protocol_doc(context)).encode()}

def write_outputs(output,files,input_paths):
    output=Path(output).resolve();require(not output.exists() and not output.is_symlink(),'Fresh output directory required')
    require(set(files)==OUTPUTS,'Only the four derived repository paths may be written')
    for path in input_paths:
        path=Path(path).resolve();require(output!=path and output not in path.parents,'Output must not contain an immutable input')
    require(output.parent.is_dir(),'Output parent must already exist')
    temporary=Path(tempfile.mkdtemp(prefix='.v63-doc-render-',dir=output.parent))
    try:
        for name,body in files.items():
            safe_name(name);file=temporary/name;file.parent.mkdir(parents=True,exist_ok=True)
            with file.open('xb') as stream:stream.write(body)
        require(not output.exists(),'Output appeared during render');os.rename(temporary,output)
    finally:
        if temporary.exists():shutil.rmtree(temporary)

def main(args):
    paths={name:Path(getattr(args,name)) for name in INPUT_NAMES};raw={}
    for name,path in paths.items():
        require(path.is_file() and not path.is_symlink(),'Regular immutable input required: '+name);raw[name]=path.read_bytes()
    context=validate_inputs(raw);files=render(context);write_outputs(args.output,files,paths.values())
    print(json.dumps({'rendered':True,'acceptanceIssued':False,'networkRequests':0,'output':str(Path(args.output).resolve()),
        'files':[{'path':name,'bytes':len(body),'sha256':sha(body)} for name,body in sorted(files.items())]},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in INPUT_NAMES:parser.add_argument('--'+name.replace('_','-'),dest=name,type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    try:main(parser.parse_args())
    except (ValueError,KeyError,TypeError,OSError) as error:parser.exit(1,'DOC RENDER REJECTED: '+str(error)+'\n')
