from gltest.direct import create_address


def test_sdk_probe_storage_and_sender(
    direct_vm,
    direct_deploy,
):
    direct_vm.check_pickling = True

    contract = direct_deploy("contracts/sdk_probe.py")

    owner_hex = contract.get_owner()

    assert isinstance(owner_hex, str)
    assert owner_hex != ""
    assert int(contract.get_counter()) == 0
    assert contract.get_label("alpha") == ""
    assert list(contract.get_history()) == []

    # Deployment occurs as the default Direct Mode sender,
    # which is therefore the stored owner.
    contract.set_label("alpha", "verified")

    assert contract.get_label("alpha") == "verified"
    assert int(contract.get_counter()) == 1
    assert list(contract.get_history()) == ["alpha"]

    # Create the non-owner address only after the contract SDK
    # has been loaded, matching the Direct Mode guidance.
    bob = create_address("memoryseal-bob")
    direct_vm.sender = bob

    with direct_vm.expect_revert("ONLY_OWNER"):
        contract.set_label("beta", "forbidden")

    assert contract.get_label("beta") == ""
    assert int(contract.get_counter()) == 1
    assert list(contract.get_history()) == ["alpha"]


def test_sdk_probe_rejects_empty_key(
    direct_vm,
    direct_deploy,
):
    direct_vm.check_pickling = True

    contract = direct_deploy("contracts/sdk_probe.py")

    with direct_vm.expect_revert("EMPTY_KEY"):
        contract.set_label("", "forbidden")

    assert contract.get_label("") == ""
    assert int(contract.get_counter()) == 0
    assert list(contract.get_history()) == []
