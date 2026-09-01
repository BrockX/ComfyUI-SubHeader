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

    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "unique_name": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                    },
                ),
                "text": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                    },
                ),
            },
            "optional": {
                "a": ("*",),
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "execute"
    CATEGORY = "Subgraph UI"

    def execute(self, unique_name, text, **kwargs):
        formatted = str(text)

        for key, value in kwargs.items():
            if value is None:
                continue

            placeholder = f"{{{key}}}"

            if placeholder in formatted:
                formatted = formatted.replace(
                    placeholder,
                    str(value)
                )

        return {
            "ui": {
                "text": [formatted],
                "unique_name": [str(unique_name)],
            },
            "result": (formatted,),
        }


class SubDisplay:
    """
    Displays a SubText node remotely using its unique name.
    """

    DESCRIPTION = "Displays a SubText node remotely using its unique name."

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "unique_name": (
                    "STRING",
                    {
                        "default": "",
                    },
                ),
            }
        }

    OUTPUT_NODE = True
    RETURN_TYPES = ()
    FUNCTION = "execute"
    CATEGORY = "Subgraph UI"

    def execute(self, unique_name):
        return {
            "ui": {
                "unique_name": [unique_name],
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

