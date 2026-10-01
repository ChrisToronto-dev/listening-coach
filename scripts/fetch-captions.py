"""Local command-line entrypoint; Vercel imports the shared extractor module."""
import json
import sys
from fetch_captions import fetch_captions

if __name__ == '__main__':
    print(json.dumps(fetch_captions(sys.argv[1])))
