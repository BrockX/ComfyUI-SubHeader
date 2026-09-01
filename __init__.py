import os

from .nodes import (
    NODE_CLASS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS,
)

# Robust cross-platform path resolution for the ComfyUI frontend loader
WEB_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]
