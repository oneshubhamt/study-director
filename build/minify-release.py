#!/usr/bin/env python3
"""Conservatively minify a staged Study Director Firebase deployment.

This intentionally avoids identifier mangling, property mangling, code folding,
dead-code removal, statement joining, and other semantic transforms. JavaScript
newlines are retained for ASI safety; only comments and horizontal formatting
whitespace outside literals are reduced. Embedded CSS is compacted without
rewriting declarations.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import shutil
from pathlib import Path


IDENT_START = re.compile(r"[A-Za-z_$]")
IDENT_PART = re.compile(r"[A-Za-z0-9_$]")
REGEX_PREFIX_WORDS = {
    "await", "case", "delete", "do", "else", "in", "instanceof", "new",
    "of", "return", "throw", "typeof", "void", "yield",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def consume_quoted(source: str, start: int, quote: str) -> int:
    index = start + 1
    while index < len(source):
        char = source[index]
        if char == "\\":
            index += 2
            continue
        index += 1
        if char == quote:
            return index
    return len(source)


def consume_regex(source: str, start: int) -> int:
    index = start + 1
    in_class = False
    while index < len(source):
        char = source[index]
        if char == "\\":
            index += 2
            continue
        if char in "\r\n":
            return start + 1
        if char == "[":
            in_class = True
        elif char == "]":
            in_class = False
        elif char == "/" and not in_class:
            index += 1
            while index < len(source) and IDENT_PART.match(source[index]):
                index += 1
            return index
        index += 1
    return start + 1


def skip_line_comment(source: str, start: int) -> int:
    end = source.find("\n", start + 2)
    return len(source) if end < 0 else end


def skip_block_comment(source: str, start: int) -> int:
    end = source.find("*/", start + 2)
    return len(source) if end < 0 else end + 2


def consume_template_expression(source: str, start: int) -> int:
    index = start
    depth = 1
    can_start_regex = True
    while index < len(source):
        char = source[index]
        nxt = source[index + 1] if index + 1 < len(source) else ""
        if char.isspace():
            index += 1
            continue
        if char in "'\"":
            index = consume_quoted(source, index, char)
            can_start_regex = False
            continue
        if char == "`":
            index = consume_template(source, index)
            can_start_regex = False
            continue
        if char == "/" and nxt == "/":
            index = skip_line_comment(source, index)
            continue
        if char == "/" and nxt == "*":
            index = skip_block_comment(source, index)
            continue
        if char == "/" and can_start_regex:
            end = consume_regex(source, index)
            if end > index + 1:
                index = end
                can_start_regex = False
                continue
        if char == "{":
            depth += 1
            index += 1
            can_start_regex = True
            continue
        if char == "}":
            depth -= 1
            index += 1
            if depth == 0:
                return index
            can_start_regex = False
            continue
        if IDENT_START.match(char):
            end = index + 1
            while end < len(source) and IDENT_PART.match(source[end]):
                end += 1
            word = source[index:end]
            can_start_regex = word in REGEX_PREFIX_WORDS
            index = end
            continue
        if char.isdigit() or (char == "." and nxt.isdigit()):
            end = index + 1
            while end < len(source) and re.match(r"[A-Za-z0-9_.]", source[end]):
                end += 1
            index = end
            can_start_regex = False
            continue
        if source.startswith("=>", index):
            index += 2
            can_start_regex = True
            continue
        if source.startswith(("++", "--"), index):
            index += 2
            can_start_regex = False
            continue
        can_start_regex = char not in ")]}"
        index += 1
    return len(source)


def consume_template(source: str, start: int) -> int:
    index = start + 1
    while index < len(source):
        char = source[index]
        if char == "\\":
            index += 2
            continue
        if char == "`":
            return index + 1
        if char == "$" and index + 1 < len(source) and source[index + 1] == "{":
            index = consume_template_expression(source, index + 2)
            continue
        index += 1
    return len(source)


def preserve_comment(comment: str) -> bool:
    lowered = comment.lower()
    return "copyright © 2026" in lowered or "license.txt" in lowered or "notice.txt" in lowered


PUNCTUATORS = tuple(sorted({
    ">>>=", "===", "!==", ">>>", "**=", "&&=", "||=", "??=", "<<=", ">>=",
    "=>", "==", "!=", "<=", ">=", "++", "--", "&&", "||", "??", "?.",
    "**", "<<", ">>", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
    "...",
}, key=len, reverse=True))


def required_js_space(previous: str, current: str) -> bool:
    if not previous or not current:
        return False
    left, right = previous[-1], current[0]
    left_word = left.isalnum() or left in "_$" or ord(left) > 127
    right_word = right.isalnum() or right in "_$" or ord(right) > 127
    if left_word and right_word:
        return True
    if previous[0].isdigit() and right == ".":
        return True
    if left == right and left in "+-":
        return True
    if left == "/" and right in "/*":
        return True
    if previous.endswith("--") and right == ">":
        return True
    if left == "<" and right == "!":
        return True
    return False


def next_nonspace_char(source: str, start: int) -> str:
    index = start
    while index < len(source) and source[index].isspace():
        index += 1
    return source[index] if index < len(source) else ""


def compress_js_word(word: str, previous: str, source: str, end: int) -> str:
    if word not in {"true", "false"}:
        return word
    following = next_nonspace_char(source, end)
    # Reserved words can legally be property names. Do not rewrite those sites.
    if previous in {".", "?."} or following in {":", "(", "=", "."}:
        return word
    return "!0" if word == "true" else "!1"


def minify_static_css_templates(source: str) -> str:
    pattern = re.compile(r"(style\.textContent\s*=\s*`)(.*?)(`)", re.DOTALL)

    def replacement(match: re.Match[str]) -> str:
        body = match.group(2)
        if "${" in body:
            return match.group(0)
        return match.group(1) + minify_css(body) + match.group(3)

    return pattern.sub(replacement, source)


def minify_js(source: str) -> str:
    source = minify_static_css_templates(source)
    output: list[str] = []
    index = 0
    can_start_regex = True
    length = len(source)
    previous_token = ""
    pending_space = False
    pending_newline = False

    def emit(token: str) -> None:
        nonlocal pending_space, pending_newline, previous_token
        if pending_newline and output:
            output.append("\n")
        elif pending_space and required_js_space(previous_token, token):
            output.append(" ")
        output.append(token)
        previous_token = token
        pending_space = False
        pending_newline = False

    while index < length:
        char = source[index]
        nxt = source[index + 1] if index + 1 < length else ""
        if char.isspace():
            end = index + 1
            while end < length and source[end].isspace():
                end += 1
            whitespace = source[index:end]
            if "\n" in whitespace or "\r" in whitespace:
                pending_newline = True
                pending_space = False
            elif not pending_newline:
                pending_space = True
            index = end
            continue
        if char == "/" and nxt == "/":
            end = skip_line_comment(source, index)
            comment = source[index:end]
            if preserve_comment(comment):
                emit(comment)
                if "\n" in comment:
                    pending_newline = True
            index = end
            continue
        if char == "/" and nxt == "*":
            end = skip_block_comment(source, index)
            comment = source[index:end]
            if preserve_comment(comment):
                emit(comment)
                if "\n" in comment:
                    pending_newline = True
            else:
                if "\n" in comment or "\r" in comment:
                    pending_newline = True
                    pending_space = False
                elif not pending_newline:
                    pending_space = True
            index = end
            continue
        if char in "'\"":
            end = consume_quoted(source, index, char)
            emit(source[index:end])
            index = end
            can_start_regex = False
            continue
        if char == "`":
            end = consume_template(source, index)
            emit(source[index:end])
            index = end
            can_start_regex = False
            continue
        if char == "/" and can_start_regex:
            end = consume_regex(source, index)
            if end > index + 1:
                emit(source[index:end])
                index = end
                can_start_regex = False
                continue
        if IDENT_START.match(char):
            end = index + 1
            while end < length and IDENT_PART.match(source[end]):
                end += 1
            word = source[index:end]
            emitted_word = compress_js_word(word, previous_token, source, end)
            emit(emitted_word)
            index = end
            can_start_regex = word in REGEX_PREFIX_WORDS
            continue
        if char.isdigit() or (char == "." and nxt.isdigit()):
            end = index + 1
            while end < length and re.match(r"[A-Za-z0-9_.]", source[end]):
                end += 1
            number = source[index:end]
            if re.fullmatch(r"0\.\d+", number):
                number = number[1:]
            emit(number)
            index = end
            can_start_regex = False
            continue
        if source.startswith("=>", index):
            emit("=>")
            index += 2
            can_start_regex = True
            continue
        if source.startswith(("++", "--"), index):
            emit(source[index:index + 2])
            index += 2
            can_start_regex = False
            continue
        punctuator = next((value for value in PUNCTUATORS if source.startswith(value, index)), char)
        emit(punctuator)
        index += len(punctuator)
        can_start_regex = char not in ")]}"
    return "".join(output).rstrip() + "\n"


def minify_css(source: str) -> str:
    output: list[str] = []
    index = 0
    while index < len(source):
        char = source[index]
        nxt = source[index + 1] if index + 1 < len(source) else ""
        if char in "'\"":
            end = consume_quoted(source, index, char)
            output.append(source[index:end])
            index = end
            continue
        if char == "/" and nxt == "*":
            index = skip_block_comment(source, index)
            continue
        if char.isspace():
            end = index + 1
            while end < len(source) and source[end].isspace():
                end += 1
            if output and output[-1] != " ":
                output.append(" ")
            index = end
            continue
        output.append(char)
        index += 1
    compact = "".join(output).strip()
    compact = re.sub(r"\s*([{}:;,>])\s*", r"\1", compact)
    compact = compact.replace(";}", "}")
    return compact


SCRIPT_RE = re.compile(r"(<script(?:\s[^>]*)?>)(.*?)(</script>)", re.IGNORECASE | re.DOTALL)
STYLE_RE = re.compile(r"(<style(?:\s[^>]*)?>)(.*?)(</style>)", re.IGNORECASE | re.DOTALL)


def minify_index(path: Path) -> None:
    source = path.read_text(encoding="utf-8")

    def script_replacement(match: re.Match[str]) -> str:
        opening, body, closing = match.groups()
        if re.search(r"\bsrc\s*=", opening, re.IGNORECASE):
            return match.group(0)
        return opening + minify_js(body).rstrip("\n") + closing

    source = SCRIPT_RE.sub(script_replacement, source)
    source = STYLE_RE.sub(lambda match: match.group(1) + minify_css(match.group(2)) + match.group(3), source)
    path.write_text(source, encoding="utf-8", newline="\n")


def rename_hashed_js(public: Path) -> dict[str, str]:
    replacements: dict[str, str] = {}
    for path in sorted(public.glob("sd.*.js")):
        if path.name == "sw.js":
            continue
        original_name = path.name
        minified = minify_js(path.read_text(encoding="utf-8"))
        path.write_text(minified, encoding="utf-8", newline="\n")
        digest = sha256_file(path)
        parts = original_name.split(".")
        new_name = ".".join(parts[:-2] + [digest[:12], "js"])
        new_path = path.with_name(new_name)
        path.rename(new_path)
        replacements[original_name] = new_name
    return replacements


def rename_hashed_css(public: Path) -> dict[str, str]:
    replacements: dict[str, str] = {}
    for path in sorted(public.glob("sd.*.css")):
        original_name = path.name
        compact = minify_css(path.read_text(encoding="utf-8")) + "\n"
        path.write_text(compact, encoding="utf-8", newline="\n")
        digest = sha256_file(path)
        parts = original_name.split(".")
        new_name = ".".join(parts[:-2] + [digest[:12], "css"])
        path.rename(path.with_name(new_name))
        replacements[original_name] = new_name
    return replacements


def apply_replacements(path: Path, replacements: dict[str, str]) -> None:
    source = path.read_text(encoding="utf-8")
    for old, new in replacements.items():
        source = source.replace(old, new)
    path.write_text(source, encoding="utf-8", newline="\n")


def extract_inline_scripts(index_source: str) -> list[str]:
    scripts = []
    for match in SCRIPT_RE.finditer(index_source):
        if not re.search(r"\bsrc\s*=", match.group(1), re.IGNORECASE):
            scripts.append(match.group(2))
    return scripts


def update_csp(header_path: Path, index_path: Path) -> None:
    data = json.loads(header_path.read_text(encoding="utf-8"))
    hashes = [
        "'sha256-" + base64.b64encode(hashlib.sha256(script.encode("utf-8")).digest()).decode("ascii") + "'"
        for script in extract_inline_scripts(index_path.read_text(encoding="utf-8"))
    ]
    for rule in data["hosting"]["headers"]:
        if rule.get("source") != "/**":
            continue
        for header in rule.get("headers", []):
            if header.get("key", "").lower() != "content-security-policy":
                continue
            value = header["value"]
            directives = [part.strip() for part in value.split(";")]
            for index, directive in enumerate(directives):
                if directive.startswith("script-src "):
                    directives[index] = "script-src 'self' " + " ".join(hashes) + " https://accounts.google.com"
                    break
            header["value"] = "; ".join(directives)
    header_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def update_service_worker(public: Path, replacements: dict[str, str]) -> None:
    sw_path = public / "sw.js"
    source = sw_path.read_text(encoding="utf-8")
    for old, new in replacements.items():
        source = source.replace(old, new)
    manifests: dict[str, list[dict[str, str]]] = {}
    for constant in ("PRECACHE",):
        match = re.search(rf"const {constant}=Object\.freeze\(JSON\.parse\('(.+?)'\)\);", source)
        if not match:
            raise RuntimeError(f"Could not locate service-worker {constant.lower()} manifest")
        manifest = json.loads(match.group(1))
        for asset in manifest:
            relative = asset["path"][2:] if asset["path"].startswith("./") else asset["path"]
            candidate = public / relative
            if not candidate.is_file():
                raise RuntimeError(f"Missing {constant.lower()} asset: {asset['path']}")
            asset["sha256"] = sha256_file(candidate)
        manifest_json = json.dumps(manifest, separators=(",", ":"), ensure_ascii=False)
        source = source[:match.start(1)] + manifest_json + source[match.end(1):]
        manifests[constant] = manifest
    precache_json = json.dumps(manifests["PRECACHE"], separators=(",", ":"), ensure_ascii=False)
    release_id = sha256_bytes(precache_json.encode("utf-8"))[:24]
    source = re.sub(r"const RELEASE_ID='[0-9a-f]+';", f"const RELEASE_ID='{release_id}';", source, count=1)
    sw_path.write_text(minify_js(source), encoding="utf-8", newline="\n")


def write_deployment_identity(destination: Path, public: Path) -> None:
    sw_path = public / "sw.js"
    sw_source = sw_path.read_text(encoding="utf-8")
    index_source = (public / "index.html").read_text(encoding="utf-8")
    release_match = re.search(r"const RELEASE_ID='([0-9a-f]+)';", sw_source)
    build_match = re.search(
        r'<meta name="study-director-build" content="([^"]+)">',
        index_source,
    )
    surface_match = re.search(r"const APP_VERSION='(SDV[A-Z][0-9]+[A-Za-z0-9]*)';", index_source)
    if not release_match or not build_match or not surface_match:
        raise RuntimeError("Deployment identity could not be derived from the minified release")
    files = sorted(str(path.relative_to(public)).replace("\\", "/") for path in public.rglob("*") if path.is_file())
    identity = {
        "format": "study-director-deployment-identity",
        "version": 1,
        "surfaceRelease": surface_match.group(1),
        "buildId": build_match.group(1),
        "serviceWorkerReleaseId": release_match.group(1),
        "indexSha256": sha256_file(public / "index.html"),
        "serviceWorkerSha256": sha256_file(sw_path),
        "publicFileCount": len(files),
        "publicFiles": files,
    }
    (destination / "DEPLOYMENT-IDENTITY.json").write_text(
        json.dumps(identity, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    if args.destination.exists():
        shutil.rmtree(args.destination)
    shutil.copytree(args.source, args.destination)
    public = args.destination / "public"
    replacements = rename_hashed_js(public)
    replacements.update(rename_hashed_css(public))
    apply_replacements(public / "index.html", replacements)
    minify_index(public / "index.html")
    for css_path in sorted(public.rglob("*.css")):
        css_path.write_text(minify_css(css_path.read_text(encoding="utf-8")) + "\n", encoding="utf-8", newline="\n")
    update_csp(args.destination / "firebase-hosting-headers.merge.json", public / "index.html")
    update_csp(args.destination / "firebase.json", public / "index.html")
    enforcement_candidate = args.destination / "firebase.enforcement-candidate.json"
    if enforcement_candidate.exists():
        update_csp(enforcement_candidate, public / "index.html")
    update_service_worker(public, replacements)
    write_deployment_identity(args.destination, public)
    print(json.dumps({"replacements": replacements}, indent=2))


if __name__ == "__main__":
    main()
