class SubHeader:
    """
    Visual UI organization node for ComfyUI Subgraphs.

    The node itself is only a configuration container.
    Its elements are rendered on the external Subgraph node.

    It does not participate in execution.
    """

    DESCRIPTION = """
Visual UI organization for ComfyUI Subgraphs.

Add Headers, Lines and Spacing elements.
These elements are displayed on the external Subgraph node
and do not affect execution.
"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "configuration": (
                    "STRING",
                    {
                        "default": "[]",
                        "multiline": True,
                        "hidden": True,
                    },
                ),
            }
        }

    RETURN_TYPES = ()

    FUNCTION = "execute"

    CATEGORY = "Subgraph UI"

    def execute(self, configuration):
        return ()

class SubText:
    """
    Markdown text template engine with auto-scanned presets and dynamic inputs.
    """
    DESCRIPTION = "Markdown text template engine with auto-scanned presets and dynamic inputs."
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "a": ("*",),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    FUNCTION = "execute"
    CATEGORY = "Subgraph UI"

    def execute(self, text, **kwargs):
        formatted = text

        # Resolve physical connected interface wire slots ({a}, {b}, etc.)
        for key, value in kwargs.items():
            placeholder = f"{{{key}}}"
            if placeholder in formatted:
                formatted = formatted.replace(placeholder, str(value))
        
        return (formatted,)


class SubDisplay:
    """
    Nœud d'affichage Markdown natif. Reçoit le contenu, un titre personnalisé,
    et un interrupteur pour activer/désactiver la projection sur le sous-graphe parent.
    """
    DESCRIPTION = "Displays text in Markdown format instantly with a customizable header and toggle switch."
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
                "title": ("STRING", {"default": "Sub Display Title"}),
                "display_on_subgraph": ("BOOLEAN", {"default": True}),
            }
        }
    
    OUTPUT_NODE = True
    RETURN_TYPES = ()
    FUNCTION = "execute"
    CATEGORY = "Subgraph UI"

    def execute(self, text, title="Sub Display Title", display_on_subgraph=True):
        return {
            "ui": {
                "text": [text], 
                "title": [title],
                "display_on_subgraph": [display_on_subgraph]
            }
        }



NODE_CLASS_MAPPINGS = {
    "SubHeader": SubHeader,
    "SubText": SubText,
    "SubDisplay": SubDisplay,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SubHeader": "Sub Header",
    "SubText": "Sub Text",
    "SubDisplay": "Sub Display",
}

