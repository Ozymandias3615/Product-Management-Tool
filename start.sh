#!/bin/bash
pip install gunicorn
gunicorn app:app --bind 0.0.0.0:$PORT 