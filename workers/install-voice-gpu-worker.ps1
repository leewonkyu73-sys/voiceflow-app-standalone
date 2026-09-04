param([string]$ApiUrl = 'https://voice.star45.net/api/voice-clone')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20 이상을 먼저 설치하세요.' }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python을 먼저 설치하세요.' }
$Gpu = (& nvidia-smi --query-gpu=name --format=csv,noheader 2>$null | Select-Object -First 1)
if (-not $Gpu) { throw 'NVIDIA GPU 또는 드라이버를 확인할 수 없습니다.' }
$RenderScript = Read-Host 'CosyVoice 렌더 어댑터 Python 파일 전체 경로'
if (!(Test-Path $RenderScript)) { throw '렌더 어댑터 파일을 찾을 수 없습니다.' }
$Token = Read-Host 'Voice Worker 연결 토큰을 붙여넣으세요' -AsSecureString
$Token | Export-Clixml (Join-Path $Root '.voice-worker-token.xml')
$Config = [ordered]@{ api_url=$ApiUrl; worker_id=('STAR45-VOICE-GPU-' + $env:COMPUTERNAME); providers='cosyvoice_3'; languages='ko-KR'; gpu_name=$Gpu; python='python'; render_script=$RenderScript }
$Config | ConvertTo-Json | Set-Content (Join-Path $Root '.voice-worker-config.json') -Encoding UTF8
$StartScript = Join-Path $Root 'start-voice-gpu-worker.ps1'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $StartScript + '"')
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'STAR45 Voice GPU Worker' -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null
Write-Host '등록 완료: STAR45 Voice GPU Worker' -ForegroundColor Green
Write-Host ('GPU: ' + $Gpu)
Write-Host '지금 실행: .\start-voice-gpu-worker.ps1'
