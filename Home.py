"""EquiSumm Root Entrypoint."""
import sys
from pathlib import Path
import runpy

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Execute the app Home page directly in Streamlit scope
_app_home = PROJECT_ROOT / "app" / "Home.py"
runpy.run_path(str(_app_home), run_name="__main__")
