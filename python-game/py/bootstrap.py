"""
Bootstrap loaded into Pyodide before each student run.

Student code looks like:
    while not is_on_treasure():
        move_right()
    open_chest()

Under the hood, every API call is async (JS Promise from the game engine).
We rewrite the student's AST to:
  1. Find any user-defined functions that (transitively) call an API.
  2. Convert those `def`s to `async def`.
  3. Inject `await` before each call to an API function or to a now-async user function.

Then run as top-level-await code via runPythonAsync. Student code remains
free of `async`/`await`. Tracebacks point at the student's original line
numbers because we compile the AST directly (no source round-trip).
"""
import ast
import traceback


# Populated from JS each run.
_API_NAMES: set[str] = set()


def _set_api_names(names):
    _API_NAMES.clear()
    # `names` may be a JsProxy of a JS array — iterate directly.
    for n in names:
        _API_NAMES.add(str(n))


def _collect_async_names(tree: ast.AST, api_names: set[str]) -> set[str]:
    """Find all user `def`s that transitively call an async name."""
    async_names = set(api_names)
    # Map function-name → set of names it calls
    func_calls: dict[str, set[str]] = {}

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            calls: set[str] = set()
            for sub in ast.walk(node):
                if isinstance(sub, ast.Call):
                    f = sub.func
                    if isinstance(f, ast.Name):
                        calls.add(f.id)
                    elif isinstance(f, ast.Attribute):
                        calls.add(f.attr)
            func_calls[node.name] = calls

    # Fixed-point: a function is async if it calls any async name.
    changed = True
    while changed:
        changed = False
        for fname, callees in func_calls.items():
            if fname in async_names:
                continue
            if callees & async_names:
                async_names.add(fname)
                changed = True
    return async_names


class _Rewriter(ast.NodeTransformer):
    def __init__(self, async_names: set[str]):
        self.async_names = async_names

    def _call_target_name(self, node: ast.Call) -> str | None:
        f = node.func
        if isinstance(f, ast.Name):
            return f.id
        if isinstance(f, ast.Attribute):
            return f.attr
        return None

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self.generic_visit(node)
        if node.name in self.async_names:
            new = ast.AsyncFunctionDef(
                name=node.name,
                args=node.args,
                body=node.body,
                decorator_list=node.decorator_list,
                returns=node.returns,
                type_comment=getattr(node, "type_comment", None),
            )
            ast.copy_location(new, node)
            return new
        return node

    def visit_Call(self, node: ast.Call):
        self.generic_visit(node)
        name = self._call_target_name(node)
        if name in self.async_names:
            new = ast.Await(value=node)
            ast.copy_location(new, node)
            return new
        return node


def _transform(source: str) -> ast.AST:
    tree = ast.parse(source, filename="<your code>")
    async_names = _collect_async_names(tree, _API_NAMES)
    tree = _Rewriter(async_names).visit(tree)
    ast.fix_missing_locations(tree)
    return tree


def _format_student_traceback(exc: BaseException) -> str:
    """Filter the traceback to frames from the student file only."""
    tb = exc.__traceback__
    lines = []
    while tb is not None:
        co = tb.tb_frame.f_code
        if co.co_filename == "<your code>":
            lines.append(f"  Line {tb.tb_lineno} in {co.co_name}\n")
        tb = tb.tb_next
    if not lines:
        return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    return "Traceback:\n" + "".join(lines) + f"{type(exc).__name__}: {exc}\n"


async def run_student_code(source: str):
    """Compile and run student source with the await injection applied."""
    try:
        tree = _transform(source)
    except SyntaxError as e:
        msg = f"SyntaxError on line {e.lineno}: {e.msg}\n"
        if e.text:
            msg += f"  {e.text.rstrip()}\n"
            if e.offset:
                msg += "  " + " " * (e.offset - 1) + "^\n"
        raise _StudentError(msg) from None

    code = compile(
        tree, "<your code>", "exec",
        flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT,
    )

    # Fresh namespace per run, but with API names already in builtins
    # via the globals object we'll set below.
    g = {"__builtins__": __builtins__, "__name__": "__main__"}
    g.update(_STUDENT_GLOBALS)

    try:
        coro = eval(code, g)
        if coro is not None:
            await coro
    except _StudentError:
        raise
    except BaseException as e:
        raise _StudentError(_format_student_traceback(e)) from e


# Filled by JS via _bind_api()
_STUDENT_GLOBALS: dict = {}


def _bind_api(mapping):
    """Bind name → JS function pairs that student code can call.

    `mapping` is a JsProxy of a plain JS object {name: jsAsyncFn, ...}.
    Iterates the registered API names and pulls each function off as an attribute.
    """
    _STUDENT_GLOBALS.clear()
    for name in _API_NAMES:
        _STUDENT_GLOBALS[name] = getattr(mapping, name)
    # Constants used as go_to targets.
    _STUDENT_GLOBALS["CHEST"] = "chest"
    _STUDENT_GLOBALS["KEY"] = "key"
    # Direction constants for turn(direction).
    _STUDENT_GLOBALS["UP"] = "up"
    _STUDENT_GLOBALS["DOWN"] = "down"
    _STUDENT_GLOBALS["LEFT"] = "left"
    _STUDENT_GLOBALS["RIGHT"] = "right"


class _StudentError(Exception):
    """Wrapper so JS can distinguish student errors from internal errors."""
    pass
