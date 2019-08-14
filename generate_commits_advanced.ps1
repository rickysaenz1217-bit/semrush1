$startDate = Get-Date "2019-06-01"
$endDate = Get-Date "2026-06-01"
$output = @()

for ($date = $startDate; $date -le $endDate; $date = $date.AddDays(1)) {
    $dayOfWeek = $date.DayOfWeek
    $isWeekend = $dayOfWeek -eq [DayOfWeek]::Saturday -or $dayOfWeek -eq [DayOfWeek]::Sunday
    
    $rand1 = Get-Random -Minimum 0 -Maximum 100
    $shouldAddEntry = $false
    
    if ($isWeekend) {
        # 3% chance for weekends
        $shouldAddEntry = $rand1 -lt 3
    } else {
        # 50% chance for weekdays
        $shouldAddEntry = $rand1 -lt 50
    }
    
    if ($shouldAddEntry) {
        $dateStr = $date.ToString("yyyy-MM-dd 10:30:00")
        $output += "`$env:GIT_COMMITTER_DATE=`"$dateStr`""
        $output += "git commit --amend --no-edit --date=`"$dateStr`""
        $output += "git branch -M main"
        $output += "git push --force origin main"
        $output += ""
        
        # 40% chance to add one more entry
        $rand2 = Get-Random -Minimum 0 -Maximum 100
        if ($rand2 -lt 40) {
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
$outputText | Set-Content -Path "d:\Project\semrush project\New Text Document (3).txt"
Write-Host "Generated $([Math]::Floor(($output | Measure-Object).Count / 5)) entries"
