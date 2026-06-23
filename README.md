# 🌍 Realistisches Minecraft

Ein realistisches 3D Minecraft-Spiel für PC & Handy – gebaut mit Three.js.

## 🚀 Starten

### Option 1 – Einfach (lokaler Server)
```bash
npx serve . -p 3000
# Dann öffne: http://localhost:3000
```

### Option 2 – Python
```bash
python3 -m http.server 3000
# Dann öffne: http://localhost:3000
```

### Option 3 – VS Code Live Server
Rechtsklick auf `index.html` → "Open with Live Server"

> **Wichtig:** Die Datei muss über HTTP geöffnet werden, nicht direkt als Datei.

---

## 🎮 Steuerung

### PC
| Taste | Aktion |
|-------|--------|
| `W/A/S/D` | Bewegen |
| `Maus` | Umschauen |
| `Leertaste` | Springen |
| `Shift` | Rennen |
| `Linksklick` | Angreifen |
| `F` | Debug-Modus |
| `ESC` | Pause |

### Handy / Tablet
| Geste | Aktion |
|-------|--------|
| Linker Joystick | Bewegen |
| Rechts wischen | Kamera drehen |
| Tippen (rechts) | Angreifen |
| ↑ Taste | Springen |
| 🐰 Taste | Rennen (umschalten) |

---

## 🌟 Features

### Welt
- **Prozedural generiertes Terrain** mit Perlin-Noise (Berge, Täler, Strände, Schnee)
- **5 Biome**: Strand, Wald, Hochland, Berge, Schnee
- **Realistisches Wasser** mit Wellenanimation und Reflexion
- **Tag/Nacht-Zyklus** (20 Minuten = 1 Tag)

### Atmosphäre
- **Atmosphärischer Himmel** mit Rayleigh-Streuung (Three.js Sky)
- **Sonne & Mond** die über den Himmel wandern
- **Sterne** die nachts erscheinen
- **Dynamisches Licht** (Morgendämmerung, Mittag, Sonnenuntergang, Nacht)
- **Wolken** die sich bewegen
- **Atmosphärischer Nebel**

### Vegetation
- **Eichenbäume** mit realistischem Blätterdach
- **Fichtenbäume** auf höheren Lagen
- **Blumen** in vielen Farben
- **Gras-Büschel** überall

### Gebäude
- **Prozedural generiertes Dorf** mit 10 Häusern
- **Häuser** mit Ziegelwänden, Schieferdach, Türen, Fenstern
- **Fenster** leuchten nachts von innen

### Monster (alle Minecraft-Monster)
| Monster | HP | Schaden | Besonderheit |
|---------|-----|---------|--------------|
| 🧟 Zombie | 20 | 3 | Nahkampf |
| 💀 Skelett | 20 | 4 | Fernkampf (Pfeile) |
| 💚 Creeper | 20 | 30 | Explosion! |
| 🕷 Spinne | 16 | 2 | Schnell |
| 👁 Enderman | 40 | 7 | Teleportiert |
| 🧙 Hexe | 26 | 6 | Tränke |
| 👻 Ghast | 10 | 12 | Fliegend |
| 🟢 Schleim | 16 | 4 | Hüpft |
| 🔥 Blaze | 20 | 5 | Feuerbälle |
| 🐷 Zombie-Piglin | 20 | 5 | Goldschwert |

### NPCs
- **Dorfbewohner** wandern durch das Dorf
- **Eisengolem** schützt das Dorf

### Spieler
- **Gesundheitssystem** mit Herzen
- **Automatische Regeneration**
- **Tag/Nacht-Alarm**
- **Kill-Zähler**
- **Debug-Modus** (Koordinaten, FPS, Biom)
