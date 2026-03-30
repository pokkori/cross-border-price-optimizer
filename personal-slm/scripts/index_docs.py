from pathlib import Path
import requests


def main() -> None:
    docs = Path("./docs")
    docs.mkdir(parents=True, exist_ok=True)
    res = requests.post("http://127.0.0.1:8008/admin/reload-index", timeout=30)
    print(res.status_code, res.text)


if __name__ == "__main__":
    main()
