#!/bin/bash

# ClubGPT-Puppet Configuration Test Script
# Easy way to test different environment configurations

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"

echo "🎭 ClubGPT-Puppet Configuration Test Script"
echo "=========================================="

# Function to apply configuration
apply_config() {
    echo "Applying config: $1"
    npm run env:set $2
}

# Function to show current config
show_current() {
    echo "📋 Current configuration:"
    npm run env:print
}

# Function to start dev server
start_dev() {
    echo "🚀 Starting dev server..."
    npm run dev
}

# Function to list available configs
show_menu() {
    echo "
📚 Available Test Configurations:
─────────────────────────────────

🎨 THEMES:
  1) Neon Purple (default)   - THEME_NAME=neon_purple
  2) Deep Teal              - THEME_NAME=deep_teal
  3) Custom Black Theme     - THEME.backgroundHex=#000000 THEME.gridMainHex=#444444
  4) Warm Orange Theme      - THEME.backgroundHex=#1a0a00 THEME.gridLineHex=#ff6b35

🎵 MODES:
  5) Sound Mode (default)   - MODE=sound
  6) Text Only Mode         - MODE=text

⚙️  FEATURES:
  7) Debug Mode On          - DEV_MODE=true
  8) Debug Mode Off         - DEV_MODE=false
  9) Memory Disabled        - MEMORY_ENABLED=false
 10) Lipsync Enabled        - LIPSYNC_ENABLED=true
 11) Avatar Custom          - AVATAR_URL=/models/avatar.glb AVATAR_SCALE=2.0

🔄 COMBINATIONS:
 12) Text + Debug + No Memory - MODE=text DEV_MODE=true MEMORY_ENABLED=false
 13) Sound + Lipsync + Teal   - MODE=sound THEME_NAME=deep_teal LIPSYNC_ENABLED=true
 14) Sound + Debug + Custom Avatar - MODE=sound DEV_MODE=true AVATAR_URL=/models/avatar.glb AVATAR_SCALE=1.5

🎯 PRESETS:
 15) Production Ready        - MODE=sound DEV_MODE=false MEMORY_ENABLED=true LIPSYNC_ENABLED=false
 16) Development Full Debug  - MODE=sound DEV_MODE=true MEMORY_ENABLED=true LIPSYNC_ENABLED=true
 17) Minimal Text Chat       - MODE=text DEV_MODE=false MEMORY_ENABLED=false LIPSYNC_ENABLED=false

🔧 UTILITIES:
  s) Show current config
  d) Start dev server
  c) Clear all env vars
  q) Quit

"
}

# Main menu loop
while true; do
    show_menu
    read -p "Choose configuration (1-16, s/d/c/q): " choice

    case $choice in
        1)
            apply_config "Neon Purple Theme" "THEME_NAME=neon_purple"
            ;;
        2)
            apply_config "Deep Teal Theme" "THEME_NAME=deep_teal"
            ;;
        3)
            apply_config "Custom Black Theme" "THEME_NAME= THEME.backgroundHex=#000000 THEME.fogHex=#111111 THEME.gridMainHex=#444444 THEME.gridLineHex=#666666"
            ;;
        4)
            apply_config "Warm Orange Theme" "THEME_NAME= THEME.backgroundHex=#1a0a00 THEME.fogHex=#4a2c00 THEME.gridLineHex=#ff6b35 THEME.spotLight1Hex=#ff4500"
            ;;
        5)
            apply_config "Sound Mode" "MODE=sound"
            ;;
        6)
            apply_config "Text Only Mode" "MODE=text"
            ;;
        7)
            apply_config "Debug Mode On" "DEV_MODE=true"
            ;;
        8)
            apply_config "Debug Mode Off" "DEV_MODE=false"
            ;;
        9)
            apply_config "Memory Disabled" "MEMORY_ENABLED=false"
            ;;
        10)
            apply_config "Lipsync Enabled" "LIPSYNC_ENABLED=true"
            ;;
        11)
            apply_config "Avatar Custom" "AVATAR_URL=/models/avatar.glb AVATAR_SCALE=2.0"
            ;;
        12)
            apply_config "Text + Debug + No Memory" "MODE=text DEV_MODE=true MEMORY_ENABLED=false"
            ;;
        13)
            apply_config "Sound + Lipsync + Teal" "MODE=sound THEME_NAME=deep_teal LIPSYNC_ENABLED=true"
            ;;
        14)
            apply_config "Sound + Debug + Custom Avatar" "MODE=sound DEV_MODE=true AVATAR_URL=/models/avatar.glb AVATAR_SCALE=1.5"
            ;;
        15)
            apply_config "Production Ready" "MODE=sound DEV_MODE=false MEMORY_ENABLED=true LIPSYNC_ENABLED=false"
            ;;
        16)
            apply_config "Development Full Debug" "MODE=sound DEV_MODE=true MEMORY_ENABLED=true LIPSYNC_ENABLED=true"
            ;;
        17)
            apply_config "Minimal Text Chat" "MODE=text DEV_MODE=false MEMORY_ENABLED=false LIPSYNC_ENABLED=false"
            ;;
        s|S)
            show_current
            ;;
        d|D)
            start_dev
            break
            ;;
        c|C)
            echo "🗑️  Clearing all environment variables..."
            rm -f "$ENV_FILE"
            echo "✅ Environment cleared"
            ;;
        q|Q)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Please select 1-16, s, d, c, or q."
            ;;
    esac

    echo ""
    read -p "Press Enter to continue..."
    clear
done
