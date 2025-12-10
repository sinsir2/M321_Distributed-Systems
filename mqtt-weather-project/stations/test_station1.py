import re
import time
import pytest


def is_valid_temperature(t):
    return isinstance(t, (int, float)) and t >= -273

def is_valid_humidity(h):
    return isinstance(h, (int, float)) and 0 <= h <= 100



def test_temperature_valid_range():
    t = 30
    assert is_valid_temperature(t)


def test_temperature_failure_case():
    t = -999
    assert not is_valid_temperature(t)


def test_humidity_range():
    h = 45.5
    assert is_valid_humidity(h)

def test_humidity_failure_case():
    h = 120
    assert not is_valid_humidity(h)

