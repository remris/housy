#!/usr/bin/env bash
# Prüft die E-Rechnungs-Fixtures (tests/erechnung/fixtures/*.xml) mit dem KoSIT-Validator
# und der offiziellen XRechnung-Konfiguration. Braucht Java 11+, curl und unzip.
# Lädt Validator und Konfiguration beim ersten Lauf von GitHub (itplr-kosit) nach .cache/kosit.
set -euo pipefail

WURZEL="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$WURZEL/.cache/kosit"
BERICHTE="$CACHE/berichte"
mkdir -p "$CACHE" "$BERICHTE"

asset_url() {
  # neuestes Release-Asset, dessen Name auf das Muster passt
  curl -fsSL "https://api.github.com/repos/$1/releases/latest" |
    grep -o '"browser_download_url": *"[^"]*"' | sed 's/.*"\(https[^"]*\)"/\1/' | grep -E "$2" | head -1
}

if ! ls "$CACHE"/validator/*standalone*.jar >/dev/null 2>&1; then
  url=$(asset_url itplr-kosit/validator 'distribution\.zip$|standalone\.jar$')
  echo "Lade Validator: $url"
  mkdir -p "$CACHE/validator"
  if [[ "$url" == *.zip ]]; then
    curl -fsSL "$url" -o "$CACHE/validator.zip"
    unzip -q -o "$CACHE/validator.zip" -d "$CACHE/validator"
    find "$CACHE/validator" -name '*standalone*.jar' -exec mv {} "$CACHE/validator/" \; 2>/dev/null || true
  else
    curl -fsSL "$url" -o "$CACHE/validator/validator-standalone.jar"
  fi
fi
if [ ! -f "$CACHE/konfiguration/scenarios.xml" ]; then
  url=$(asset_url itplr-kosit/validator-configuration-xrechnung '\.zip$')
  echo "Lade XRechnung-Konfiguration: $url"
  curl -fsSL "$url" -o "$CACHE/konfiguration.zip"
  mkdir -p "$CACHE/konfiguration"
  unzip -q -o "$CACHE/konfiguration.zip" -d "$CACHE/konfiguration"
fi

JAR=$(ls "$CACHE"/validator/*standalone*.jar | head -1)
rm -f "$BERICHTE"/*
java -jar "$JAR" -s "$CACHE/konfiguration/scenarios.xml" -r "$CACHE/konfiguration" -o "$BERICHTE" \
  "$WURZEL"/tests/erechnung/fixtures/*.xml || true

fehler=0
for datei in "$WURZEL"/tests/erechnung/fixtures/*.xml; do
  name=$(basename "$datei" .xml)
  bericht="$BERICHTE/$name-report.xml"
  if [ ! -f "$bericht" ]; then
    echo "FEHLT    $name (kein Bericht)"
    fehler=1
  elif grep -q '<rep:accept' "$bericht"; then
    echo "OK       $name"
  else
    echo "ABGELEHNT $name"
    grep -o '<rep:message[^>]*>[^<]*' "$bericht" | sed 's/<rep:message[^>]*>/  - /' | head -20 || true
    fehler=1
  fi
done
exit $fehler
