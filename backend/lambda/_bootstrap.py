"""Bootstrap module for Lambda handlers.

This module handles the sys.path manipulation needed to import
shared modules from backend/src. Import this module at the top
of each Lambda handler file.

Usage:
    import _bootstrap  # noqa: F401
    from app.auth import require_admin
    ...
"""

import os
import sys

# Calculate paths relative to this bootstrap file
_LAMBDA_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_LAMBDA_DIR)
_SRC_DIR = os.path.join(_BACKEND_DIR, 'src')

# Add src directory to Python path if not already present
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)
