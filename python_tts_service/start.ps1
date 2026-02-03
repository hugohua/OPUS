$ErrorActionPreference = "Stop"

# Go to script directory
Set-Location $PSScriptRoot

# Check Python
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python not found. Please install Python."
    exit 1
}

# Create venv
if (!(Test-Path "venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv venv
    Write-Host "Installing dependencies..."
    .\venv\Scripts\pip install -r requirements.txt
}

# Load .env (Basic parsing from root directory)
if (Test-Path "../.env") {
    Get-Content "../.env" | ForEach-Object {
        if ($_ -match "^\s*([^#=]+)\s*=\s*(.*)$") {
            $key = $matches[1]
            $value = $matches[2]
            # Remove optional quotes
            if ($value -match "^['`"](.*)['`"]$") {
                $value = $matches[1]
            }
            # Only set if not already set (preserve system/process envs)
            if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($key, "Process"))) {
                [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    }
}

# Check API Key
if ([string]::IsNullOrEmpty($env:TTS_API_KEY)) {
    Write-Warning "TTS_API_KEY is not set. Please set it via .env file."
}

Write-Host "Starting TTS Service..."
.\venv\Scripts\uvicorn main:app --reload --host 0.0.0.0 --port 8000
