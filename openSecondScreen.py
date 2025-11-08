import time
import subprocess
import os
import tempfile

def move_and_resize_chrome_window(x, y, width, height):
    script = f'''
    delay 1
    tell application "System Events"
        tell application process "Google Chrome"
            try
                set position of front window to {{{x}, {y}}}
                set size of front window to {{{width}, {height}}}
            on error
                display dialog "No se pudo mover la ventana"
            end try
        end tell
    end tell
    '''
    subprocess.run(['osascript', '-e', script])
    print(f"Chrome movido a {x},{y} con tamaño {width}x{height}")

# URL que querés abrir
url = "http://localhost:9002"

# Crear un perfil temporal para lanzar Chrome en nueva instancia
profile_dir = tempfile.mkdtemp(prefix="chrome-profile-")

# Ruta de Chrome
chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Lanzar nueva instancia de Chrome en modo app o kiosco
subprocess.Popen([
    chrome_path,
    f"--user-data-dir={profile_dir}",
    "--new-window",
    "--kiosk",
    url
])

# Esperar a que la ventana se abra
time.sleep(3)

# Coordenadas del monitor secundario (ajustá a tu configuración)
SECOND_MONITOR_X = -1920  # o 0 si está arriba o abajo
SECOND_MONITOR_Y = 0
WIDTH = 1920
HEIGHT = 1080

# Mover ventana
move_and_resize_chrome_window(SECOND_MONITOR_X, SECOND_MONITOR_Y, WIDTH, HEIGHT)