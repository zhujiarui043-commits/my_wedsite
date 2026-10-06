$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskLatest = Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'dist-desktop/latest.json') | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $taskLatest.executable -PathType Leaf)) { throw 'Build Jerry Studio first.' }
$taskDesktop = [Environment]::GetFolderPath('Desktop')
$taskShortcutPath = Join-Path $taskDesktop 'Jerry Studio.lnk'
$taskShell = New-Object -ComObject WScript.Shell
if (Test-Path -LiteralPath $taskShortcutPath) {
  $taskExisting = $taskShell.CreateShortcut($taskShortcutPath)
  if ($taskExisting.TargetPath -notlike (Join-Path $taskRoot 'dist-desktop\*')) {
    $taskShortcutPath = Join-Path $taskDesktop 'Jerry Studio 0.1.lnk'
    if (Test-Path -LiteralPath $taskShortcutPath) { throw 'A different shortcut already exists at this location.' }
  }
}
$taskShortcut = $taskShell.CreateShortcut($taskShortcutPath)
$taskShortcut.TargetPath = $taskLatest.executable
$taskShortcut.WorkingDirectory = $taskLatest.directory
$taskShortcut.IconLocation = Join-Path $taskLatest.directory 'resources/app/icon.ico'
$taskShortcut.Description = 'Manage Notes, Gallery, and Journey on your personal website.'
$taskShortcut.Save()
Write-Output "Desktop shortcut ready: $taskShortcutPath"
