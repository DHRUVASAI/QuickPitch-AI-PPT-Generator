$pptx = "scratch/real_pipeline_hindi_deck.pptx"
$zip = "scratch/real_pipeline_hindi_deck.zip"
Copy-Item $pptx $zip -Force
$dest = "scratch/extracted_pptx"
Expand-Archive -Path $zip -DestinationPath $dest -Force

$slides = Get-ChildItem "$dest/ppt/slides/slide*.xml" | Sort-Object { [int]($_.BaseName -replace '\D','') }
Write-Host "Total Slides Found: $($slides.Count)"

foreach ($s in $slides) {
    Write-Host "`n================ $($s.BaseName.ToUpper()) ================"
    $content = Get-Content $s.FullName -Raw
    $matches = [regex]::Matches($content, '<a:t>([^<]+)</a:t>')
    $unique = @()
    foreach ($m in $matches) {
        $val = $m.Groups[1].Value.Trim()
        if ($val -and ($unique -notcontains $val)) {
            $unique += $val
        }
    }
    foreach ($u in $unique) {
        Write-Host "  * $u"
    }
}
