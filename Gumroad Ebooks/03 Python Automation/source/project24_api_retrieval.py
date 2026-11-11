"""Project 24: fetch public test data from JSONPlaceholder (a free,
documented, no-key API meant for practice) and summarise it.
Uses only the standard library. Be polite: few requests, a pause between
them, a timeout, and a local cache file so reruns need no network."""
import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "https://jsonplaceholder.typicode.com"


def fetch_json(url, token=None):
    headers = {"User-Agent": "python-automation-book-demo/1.0",
               "Accept": "application/json"}
    if token:  # a real API key would come from an environment variable
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def main(argv=None):
    parser = argparse.ArgumentParser(description="API data retrieval.")
    parser.add_argument("--users", type=int, default=3, help="how many users")
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--cache", type=Path, default=Path("api_cache.json"))
    args = parser.parse_args(argv)
    if not 1 <= args.users <= 10:
        print("Error: --users must be between 1 and 10.")
        return 1
    token = os.environ.get("EXAMPLE_API_TOKEN")  # optional; never hard-code

    try:
        users = fetch_json(f"{args.base_url}/users", token)[: args.users]
        report = []
        for user in users:
            time.sleep(1)  # rate limiting: one request per second
            todos = fetch_json(f"{args.base_url}/todos?userId={user['id']}", token)
            done = sum(1 for t in todos if t["completed"])
            report.append({"id": user["id"], "name": user["name"],
                           "city": user["address"]["city"],
                           "todos": len(todos), "done": done})
        args.cache.write_text(json.dumps(report, indent=2), encoding="utf-8")
        source = "live API"
    except urllib.error.HTTPError as error:
        print(f"The server answered with an error: {error.code} {error.reason}")
        return 1
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"Could not reach the API ({error}).")
        if not args.cache.exists():
            print("No cached copy exists yet. Try again when online.")
            return 1
        report = json.loads(args.cache.read_text(encoding="utf-8"))
        source = f"cache file {args.cache.name} (may be out of date)"
    except (json.JSONDecodeError, KeyError) as error:
        print(f"Unexpected data from the API: {error!r}")
        return 1

    print(f"Data source: {source}")
    for r in report:
        print(f"  {r['id']}. {r['name']:<22} {r['city']:<14} "
              f"{r['done']}/{r['todos']} todos done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
