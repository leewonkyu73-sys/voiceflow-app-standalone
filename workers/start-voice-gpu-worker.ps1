$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SecretPath = Join-Path $Root '.voice-worker-token.xml'
$ConfigPath = Join-Path $Root '.voice-worker-config.json'
if (!(Test-Path $SecretPath) -or !(Test-Path $ConfigPath)) { throw '먼저 install-voice-gpu-worker.ps1을 실행하세요.' }
$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$SecureToken = Import-Clixml $SecretPath
$Credential = New-Object System.Management.Automation.PSCredential('voice-worker', $SecureToken)
$env:VOICE_WORKER_TOKEN = $Credential.GetNetworkCredential().Password
$env:VOICE_WORKER_API_URL = $Config.api_url
$env:VOICE_WORKER_ID = $Config.worker_id
$env:VOICE_WORKER_PROVIDERS = $Config.providers
$env:VOICE_WORKER_LANGUAGES = $Config.languages
$env:VOICE_WORKER_GPU_NAME = $Config.gpu_name
$env:VOICE_WORKER_PYTHON = $Config.python
$env:VOICE_WORKER_RENDER_SCRIPT = $Config.render_script
$env:VOICE_WORKER_POLL_MS = '5000'
node (Join-Path $Root 'voice-gpu-pc-worker.mjs')
