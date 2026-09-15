# NON-CANONICAL HISTORICAL DEVELOPMENT ARTIFACT.
# NOT the finalized Bradbury Main or Registry source. See contracts/README.md.

# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class MemorySealSdkProbe(gl.Contract):
    owner: Address
    counter: u256
    labels: TreeMap[str, str]
    history: DynArray[str]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.counter = u256(0)

    @gl.public.view
    def get_owner(self) -> str:
        return self.owner.as_hex

    @gl.public.view
    def get_counter(self) -> u256:
        return self.counter

    @gl.public.view
    def get_label(self, key: str) -> str:
        return self.labels.get(key, "")

    @gl.public.view
    def get_history(self) -> list[str]:
        return [item for item in self.history]

    @gl.public.write
    def set_label(self, key: str, value: str) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("ONLY_OWNER")

        if key == "":
            raise gl.vm.UserError("EMPTY_KEY")

        self.labels[key] = value
        self.history.append(key)
        self.counter += u256(1)
