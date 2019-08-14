$startDate = Get-Date "2019-06-01"
$endDate = Get-Date "2026-06-01"
$output = @()

for ($date = $startDate; $date -le $endDate; $date = $date.AddDays(1)) {
    $dayOfWeek = $date.DayOfWeek
    $isWeekend = $dayOfWeek -eq [DayOfWeek]::Saturday -or $dayOfWeek -eq [DayOfWeek]::Sunday
    
    $rand = Get-Random -Minimum 0 -Maximum 100
    
    if ($isWeekend) {
        # 3% chance for weekends
        if ($rand -lt 3) {
            $dateStr = $date.ToString("yyyy-MM-dd 10:30:00")
            $output += "`$env:GIT_COMMITTER_DATE=`"$dateStr`""
            $output += "git commit --amend --no-edit --date=`"$dateStr`""
            $output += "git branch -M main"
            $output += "git push --force origin main"
            $output += ""
        }
    } else {
        # 50% chance for weekdays
        if ($rand -lt 50) {
            $dateStr = $date.ToString("yyyy-MM-dd 10:30:00")
            $output += "`$env:GIT_COMMITTER_DATE=`"$dateStr`""
            $output += "git commit --amend --no-edit --date=`"$dateStr`""
            $output += "git branch -M main"
            $output += "git push --force origin main"
            $output += ""
        }
    }
}

$outputText = $output -join "`n"
$outputText | Set-Content -Path "d:\Project\semrush project\hello.txt"
Write-Host "Generated $([Math]::Floor(($output | Measure-Object).Count / 5)) entries"
