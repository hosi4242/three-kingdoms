$ErrorActionPreference = 'Stop'
$RepoUrl = 'https://github.com/hosi4242/three-kingdoms.git'
$Branch = 'main'
$ProjectRoot = $PSScriptRoot
$Required = @('browser-test', 'android-apk-project', 'tools', 'docs', 'README_KO.md')

Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' 삼국지: 천하패권 v1.0.1 GitHub 업로드' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
foreach ($item in $Required) {
    if (-not (Test-Path (Join-Path $ProjectRoot $item))) {
        throw "필수 프로젝트 파일이 없습니다: $item`nZIP 압축을 정상적으로 풀었는지 확인해주세요."
    }
}

# GitHub Desktop에 포함된 Git을 우선 탐색합니다. PATH에 Git이 있으면 그것을 사용합니다.
$GitCommand = Get-Command git -ErrorAction SilentlyContinue
$GitExe = if ($GitCommand) { $GitCommand.Source } else { $null }
if (-not $GitExe) {
    $DesktopRoot = Join-Path $env:LOCALAPPDATA 'GitHubDesktop'
    $AppDirs = @()
    if (Test-Path $DesktopRoot) {
        $AppDirs = Get-ChildItem -Path (Join-Path $DesktopRoot 'app-*') -Directory -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
    }
    foreach ($app in $AppDirs) {
        $candidates = @(
            (Join-Path $app.FullName 'resources\app\git\cmd\git.exe'),
            (Join-Path $app.FullName 'resources\app\git\mingw64\bin\git.exe'),
            (Join-Path $app.FullName 'resources\app\git\bin\git.exe')
        )
        foreach ($candidate in $candidates) {
            if (Test-Path $candidate) { $GitExe = $candidate; break }
        }
        if ($GitExe) { break }
    }
}
if (-not $GitExe) {
    throw 'Git 실행 파일을 찾지 못했습니다. GitHub Desktop을 한 번 실행한 뒤 다시 시도해주세요.'
}

$GitDir = Split-Path -Parent $GitExe
$env:PATH = "$GitDir;$env:PATH"
$GitParent = Split-Path -Parent $GitDir
foreach ($extra in @((Join-Path $GitParent 'mingw64\bin'), (Join-Path $GitParent 'usr\bin'))) {
    if (Test-Path $extra) { $env:PATH = "$extra;$env:PATH" }
}
Write-Host "사용할 Git: $GitExe" -ForegroundColor DarkGray

$GitName = (& $GitExe config --global user.name 2>$null)
$GitEmail = (& $GitExe config --global user.email 2>$null)
if ([string]::IsNullOrWhiteSpace($GitName)) {
    $GitName = Read-Host '커밋 작성자 이름을 입력하세요'
    if ([string]::IsNullOrWhiteSpace($GitName)) { throw '작성자 이름이 입력되지 않았습니다.' }
    & $GitExe config --global user.name $GitName
}
if ([string]::IsNullOrWhiteSpace($GitEmail)) {
    $GitEmail = Read-Host 'GitHub 계정에 등록된 이메일을 입력하세요'
    if ([string]::IsNullOrWhiteSpace($GitEmail)) { throw '작성자 이메일이 입력되지 않았습니다.' }
    & $GitExe config --global user.email $GitEmail
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Work = Join-Path $env:TEMP "cheonhap-v100-upload-$Stamp"
New-Item -ItemType Directory -Path $Work | Out-Null
$Repo = Join-Path $Work 'repo'
try {
    Write-Host '[1/5] GitHub main 저장소를 내려받습니다...' -ForegroundColor Yellow
    & $GitExe clone --branch $Branch $RepoUrl $Repo
    if ($LASTEXITCODE -ne 0) { throw '저장소 복제에 실패했습니다. 인터넷 연결을 확인해주세요.' }
    $CurrentBranch = (& $GitExe -C $Repo branch --show-current).Trim()
    if ($CurrentBranch -ne $Branch) { throw "안전 확인 실패: main 브랜치가 아닙니다. ($CurrentBranch)" }

    Write-Host '[2/5] v1.0.1 프로젝트 파일을 반영합니다...' -ForegroundColor Yellow
    foreach ($folder in @('browser-test', 'android-apk-project', 'tools', 'docs')) {
        $source = Join-Path $ProjectRoot $folder
        $target = Join-Path $Repo $folder
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        & robocopy $source $target /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS | Out-Null
        $copyCode = $LASTEXITCODE
        if ($copyCode -ge 8) { throw "파일 복사 실패: $folder (robocopy 코드 $copyCode)" }
    }
    Copy-Item (Join-Path $ProjectRoot 'README_KO.md') (Join-Path $Repo 'README_KO.md') -Force

    Write-Host '[3/5] 변경 파일을 검사하고 커밋합니다...' -ForegroundColor Yellow
    & $GitExe -C $Repo add -- browser-test android-apk-project tools docs README_KO.md
    if ($LASTEXITCODE -ne 0) { throw 'Git add 단계에서 오류가 발생했습니다.' }
    & $GitExe -C $Repo diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw '커밋 전 파일 검사에 실패했습니다.' }
    & $GitExe -C $Repo diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host '반영할 변경 사항이 없습니다.' -ForegroundColor Green
    } else {
        & $GitExe -C $Repo commit -m 'release v1.0.1 portrait integration'
        if ($LASTEXITCODE -ne 0) { throw '커밋에 실패했습니다.' }
        Write-Host '[4/5] GitHub main으로 업로드합니다...' -ForegroundColor Yellow
        & $GitExe -C $Repo push origin $Branch
        if ($LASTEXITCODE -ne 0) {
            throw "푸시에 실패했습니다. GitHub 인증을 확인한 뒤 다시 실행해주세요. 작업 폴더: $Repo"
        }
    }
    $Commit = (& $GitExe -C $Repo rev-parse HEAD).Trim()
    Write-Host '[5/5] 업로드 완료' -ForegroundColor Green
    Write-Host "브랜치: $Branch"
    Write-Host "커밋: $Commit"
    Write-Host 'GitHub에 반영되었습니다. Cloudflare는 저장소 연결 설정에 따라 자동 배포됩니다.' -ForegroundColor Green
    Write-Host "진단용 작업 폴더: $Repo" -ForegroundColor DarkGray
} catch {
    Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "진단용 작업 폴더: $Work" -ForegroundColor Yellow
    exit 1
}
