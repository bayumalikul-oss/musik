const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const historyEl = document.getElementById("history");
const statusEl = document.getElementById("status");
const themeToggle = document.getElementById("themeToggle");

let expression = "";
let justCalculated = false;

function formatNumber(value) {
  if (!Number.isFinite(value)) return "Error";
  const rounded = Number.parseFloat(value.toPrecision(12));
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 10
  }).format(rounded);
}

function updateDisplay() {
  expressionEl.textContent = expression || "0";

  if (!expression) {
    resultEl.textContent = "0";
    return;
  }

  try {
    const value = evaluate(expression);
    resultEl.textContent = formatNumber(value);
  } catch {
    resultEl.textContent = "…";
  }
}

function sanitize(expr) {
  return expr
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replace(/[^0-9+\-*/().%\s]/g, "");
}

function evaluate(expr) {
  let safe = sanitize(expr)
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");

  if (!safe || /[+*/.-]$/.test(safe)) throw new Error("Incomplete");

  // Safe after sanitization: only numbers/operators/parentheses/percent conversion remain.
  const value = Function(`"use strict"; return (${safe})`)();

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid");
  }
  return value;
}

function addValue(value) {
  if (justCalculated && /[0-9.]/.test(value)) {
    expression = "";
    historyEl.textContent = "";
  }
  justCalculated = false;

  const last = expression.slice(-1);

  if (/[+×÷−]/.test(value)) {
    if (!expression && value !== "−") return;
    if (/[+×÷−]/.test(last)) {
      expression = expression.slice(0, -1) + value;
    } else {
      expression += value;
    }
  } else if (value === ".") {
    const current = expression.split(/[+×÷−]/).pop();
    if (current.includes(".")) return;
    expression += current ? "." : "0.";
  } else {
    expression += value;
  }

  updateDisplay();
}

function clearAll() {
  expression = "";
  historyEl.textContent = "";
  statusEl.textContent = "Siap digunakan";
  justCalculated = false;
  updateDisplay();
}

function deleteLast() {
  expression = expression.slice(0, -1);
  justCalculated = false;
  updateDisplay();
}

function calculate() {
  if (!expression) return;

  try {
    const value = evaluate(expression);
    historyEl.textContent = `${expression} =`;
    expression = String(Number.parseFloat(value.toPrecision(12)));
    resultEl.textContent = formatNumber(value);
    expressionEl.textContent = expression;
    statusEl.textContent = "Hasil dihitung";
    justCalculated = true;
  } catch {
    resultEl.textContent = "Error";
    statusEl.textContent = "Ekspresi tidak valid";
  }
}

function percent() {
  if (!expression) return;
  const match = expression.match(/(\d+(?:\.\d+)?)$/);
  if (!match) return;

  const number = Number(match[1]);
  const replacement = String(number / 100);
  expression = expression.slice(0, match.index) + replacement;
  updateDisplay();
}

document.querySelector(".keys").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const { value, action } = button.dataset;

  if (value !== undefined) addValue(value);
  if (action === "clear") clearAll();
  if (action === "delete") deleteLast();
  if (action === "calculate") calculate();
  if (action === "percent") percent();
});

document.addEventListener("keydown", (event) => {
  const keyMap = {
    "*": "×",
    "/": "÷",
    "-": "−",
    "+": "+",
    ".": "."
  };

  if (/\d/.test(event.key)) {
    addValue(event.key);
  } else if (keyMap[event.key]) {
    addValue(keyMap[event.key]);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    calculate();
  } else if (event.key === "Backspace") {
    deleteLast();
  } else if (event.key === "Escape") {
    clearAll();
  } else if (event.key === "%") {
    percent();
  }
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light");
  themeToggle.textContent = document.body.classList.contains("light") ? "☀" : "☾";
});

updateDisplay();
