# -*- coding: utf-8 -*-
"""Test configs."""
import os
from depmap.app import create_app
from depmap.read_config import read_config


def test_dev_config():
    """Development config."""
    DevConfig = read_config(env_name="dev", config_path="../config/dev/settings.py")

    DevConfig.SECRET_KEY = "secret-key-test"
    app = create_app(DevConfig)
    assert app.config["ENV"] == "dev"
    assert app.config["DEBUG"] is True
    assert app.config["ASSETS_DEBUG"] is True
