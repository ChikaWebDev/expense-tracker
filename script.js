// Expense Tracker application logic.
const form = document.getElementById("transactionForm");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("transactionDate");
const transactionList = document.getElementById("transactionList");
const searchInput = document.getElementById("search");
const filterInput = document.getElementById("filter");
const themeToggle = document.getElementById("themeToggle");
const monthPicker = document.getElementById("insightsMonth");
const monthlyChart = document.getElementById("monthlyChart");
const categoryBreakdown = document.getElementById("categoryBreakdown");
const monthlyReportBody = document.getElementById("monthlyReportBody");

const STORAGE_KEY = "expenseTrackerData";
const LEGACY_STORAGE_KEY = "transactions";
const THEME_KEY = "expenseTrackerTheme";

function formatMoney(amount) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN"
    }).format(amount);
}

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function isValidDateString(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
}

function loadTransactions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY) ??
            localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]";
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter(transaction => transaction &&
                typeof transaction.description === "string" &&
                transaction.description.trim() &&
                Number.isFinite(Number(transaction.amount)) &&
                Number(transaction.amount) > 0 &&
                ["income", "expense"].includes(transaction.type))
            .map((transaction, index) => ({
                id: transaction.id ?? `saved-${index}-${Date.now()}`,
                description: transaction.description.trim(),
                amount: Number(transaction.amount),
                type: transaction.type,
                category: typeof transaction.category === "string" && transaction.category
                    ? transaction.category
                    : "Other",
                date: typeof transaction.date === "string" &&
                    isValidDateString(transaction.date.slice(0, 10))
                    ? transaction.date.slice(0, 10)
                    : localDateString()
            }));
    } catch (error) {
        console.error("Unable to load saved transactions:", error);
        return [];
    }
}

let transactions = loadTransactions();

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        return true;
    } catch (error) {
        console.error("Unable to save transactions:", error);
        alert("Your browser could not save this change. Check available storage and try again.");
        return false;
    }
}

function displayTransactions() {
    const searchTerm = searchInput.value.trim().toLocaleLowerCase();
    const selectedType = filterInput.value;
    const matchingTransactions = transactions.filter(transaction => {
        const searchableText = `${transaction.description} ${transaction.category}`.toLocaleLowerCase();
        return searchableText.includes(searchTerm) &&
            (selectedType === "all" || transaction.type === selectedType);
    });

    transactionList.replaceChildren();

    if (matchingTransactions.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "empty";
        emptyMessage.textContent = transactions.length
            ? "No transactions match your search."
            : "No transactions yet. Add one to get started.";
        transactionList.appendChild(emptyMessage);
        return;
    }

    matchingTransactions.forEach(transaction => {
        const item = document.createElement("div");
        item.className = "transaction";

        const left = document.createElement("div");
        const heading = document.createElement("h4");
        heading.textContent = transaction.description;
        const details = document.createElement("small");
        details.textContent = `${transaction.category} • ${transaction.date}`;
        left.append(heading, details);

        const right = document.createElement("div");
        right.className = "transaction-right";
        const amount = document.createElement("div");
        amount.className = `amount ${transaction.type === "income" ? "positive" : "negative"}`;
        amount.textContent = `${transaction.type === "income" ? "+" : "-"}${formatMoney(transaction.amount)}`;

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-btn";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", `Delete ${transaction.description}`);
        deleteButton.addEventListener("click", () => deleteTransaction(transaction.id));

        right.append(amount, deleteButton);
        item.append(left, right);
        transactionList.appendChild(item);
    });
}

function updateDashboard() {
    let totalIncome = 0;
    let totalExpenses = 0;
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const currentMonth = localDateString().slice(0, 7);

    transactions.forEach(transaction => {
        const isCurrentMonth = transaction.date.slice(0, 7) === currentMonth;
        if (transaction.type === "income") {
            totalIncome += transaction.amount;
            if (isCurrentMonth) monthlyIncome += transaction.amount;
        } else {
            totalExpenses += transaction.amount;
            if (isCurrentMonth) monthlyExpenses += transaction.amount;
        }
    });

    document.getElementById("balance").textContent = formatMoney(totalIncome - totalExpenses);
    document.getElementById("income").textContent = formatMoney(totalIncome);
    document.getElementById("expenses").textContent = formatMoney(totalExpenses);
    document.getElementById("monthlyIncome").textContent = formatMoney(monthlyIncome);
    document.getElementById("monthlyExpense").textContent = formatMoney(monthlyExpenses);
    updateInsights();
}

function getMonthKey(date, offset = 0) {
    return localDateString(new Date(date.getFullYear(), date.getMonth() + offset, 1)).slice(0, 7);
}

function monthLabel(monthKey, options = { month: "short", year: "2-digit" }) {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-NG", options);
}

function summarizeMonth(monthKey) {
    return transactions.reduce((summary, transaction) => {
        if (transaction.date.slice(0, 7) === monthKey) {
            summary[transaction.type] += transaction.amount;
        }
        return summary;
    }, { income: 0, expense: 0 });
}

function updateMonthlyChart() {
    const months = Array.from({ length: 6 }, (_, index) => getMonthKey(new Date(), index - 5));
    const values = months.map(month => ({ month, ...summarizeMonth(month) }));
    const maxValue = Math.max(1, ...values.flatMap(value => [value.income, value.expense]));
    monthlyChart.replaceChildren();

    if (transactions.length === 0) {
        const empty = document.createElement("p");
        empty.className = "chart-empty";
        empty.textContent = "Add transactions to see your monthly chart.";
        monthlyChart.appendChild(empty);
        return;
    }

    values.forEach(value => {
        const group = document.createElement("div");
        group.className = "chart-month";
        group.setAttribute("aria-label", `${monthLabel(value.month, { month: "long", year: "numeric" })}: income ${formatMoney(value.income)}, expenses ${formatMoney(value.expense)}`);

        const bars = document.createElement("div");
        bars.className = "chart-bars";
        [["income", value.income], ["expense", value.expense]].forEach(([type, amount]) => {
            const bar = document.createElement("div");
            bar.className = `chart-bar ${type}-bar`;
            bar.style.height = `${amount === 0 ? 2 : Math.max(4, amount / maxValue * 100)}%`;
            bar.title = `${type === "income" ? "Income" : "Expenses"}: ${formatMoney(amount)}`;
            bars.appendChild(bar);
        });

        const label = document.createElement("span");
        label.textContent = monthLabel(value.month);
        group.append(bars, label);
        monthlyChart.appendChild(group);
    });
}

function updateCategoryBreakdown() {
    const monthKey = monthPicker.value || getMonthKey(new Date());
    const totals = new Map();
    transactions.forEach(transaction => {
        if (transaction.type !== "expense" || transaction.date.slice(0, 7) !== monthKey) return;
        const category = transaction.category || "Other";
        totals.set(category, (totals.get(category) || 0) + transaction.amount);
    });

    const sortedCategories = [...totals.entries()].sort((first, second) => second[1] - first[1]);
    const total = sortedCategories.reduce((sum, [, amount]) => sum + amount, 0);
    categoryBreakdown.replaceChildren();

    if (sortedCategories.length === 0) {
        const empty = document.createElement("p");
        empty.className = "chart-empty";
        empty.textContent = `No expenses recorded for ${monthLabel(monthKey, { month: "long", year: "numeric" })}.`;
        categoryBreakdown.appendChild(empty);
        return;
    }

    sortedCategories.forEach(([category, amount]) => {
        const row = document.createElement("div");
        row.className = "category-row";
        const heading = document.createElement("div");
        heading.className = "category-row-heading";
        const name = document.createElement("span");
        name.textContent = category;
        const value = document.createElement("strong");
        value.textContent = formatMoney(amount);
        heading.append(name, value);

        const track = document.createElement("div");
        track.className = "category-track";
        const fill = document.createElement("div");
        fill.className = "category-fill";
        fill.style.width = `${amount / total * 100}%`;
        track.appendChild(fill);

        const share = document.createElement("small");
        share.textContent = `${(amount / total * 100).toFixed(1)}% of monthly expenses`;
        row.append(heading, track, share);
        categoryBreakdown.appendChild(row);
    });
}

function updateMonthlyReport() {
    const monthKeys = [...new Set(transactions.map(transaction => transaction.date.slice(0, 7)))].sort().reverse();
    monthlyReportBody.replaceChildren();

    if (monthKeys.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.className = "report-empty";
        cell.textContent = "Your monthly report will appear here.";
        row.appendChild(cell);
        monthlyReportBody.appendChild(row);
        return;
    }

    monthKeys.forEach(month => {
        const summary = summarizeMonth(month);
        const row = document.createElement("tr");
        [
            monthLabel(month, { month: "long", year: "numeric" }),
            formatMoney(summary.income),
            formatMoney(summary.expense),
            formatMoney(summary.income - summary.expense)
        ].forEach(text => {
            const cell = document.createElement("td");
            cell.textContent = text;
            row.appendChild(cell);
        });
        monthlyReportBody.appendChild(row);
    });
}

function updateInsights() {
    updateMonthlyChart();
    updateCategoryBreakdown();
    updateMonthlyReport();
}

function exportTransactionsCsv() {
    if (transactions.length === 0) {
        alert("There are no transactions to export yet.");
        return;
    }

    const escapeCsv = value => {
        let safeValue = String(value ?? "");
        if (/^[\s]*[=+@\-]/.test(safeValue)) safeValue = `'${safeValue}`;
        return `"${safeValue.replace(/"/g, '""')}"`;
    };
    const rows = [
        ["Date", "Description", "Type", "Category", "Amount (NGN)"],
        ...transactions.map(transaction => [
            transaction.date,
            transaction.description,
            transaction.type,
            transaction.category,
            transaction.amount.toFixed(2)
        ])
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expense-tracker-${localDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderApp() {
    updateDashboard();
    displayTransactions();
}

function deleteTransaction(id) {
    if (!confirm("Delete this transaction?")) return;

    const previousTransactions = transactions;
    transactions = transactions.filter(transaction => transaction.id !== id);
    if (saveTransactions()) renderApp();
    else transactions = previousTransactions;
}

function setTheme(theme) {
    const isLight = theme === "light";
    document.body.classList.toggle("light-theme", isLight);
    themeToggle.setAttribute("aria-pressed", String(isLight));
    const action = isLight ? "dark" : "light";
    themeToggle.setAttribute("aria-label", `Switch to ${action} mode`);
    themeToggle.title = `Switch to ${action} mode`;
}

form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);
    const date = dateInput.value;
    const validCategory = [...categoryInput.options].some(option => option.value === categoryInput.value);
    const hasAtMostTwoDecimals = Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;
    if (description.length < 2 || description.length > 80 ||
        !Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99 ||
        !hasAtMostTwoDecimals || !["income", "expense"].includes(typeInput.value) ||
        !validCategory || !isValidDateString(date) || date > localDateString()) {
        alert("Check the description, amount (up to two decimal places), category, and date. Future dates are not allowed.");
        return;
    }

    const transaction = {
        id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description,
        amount,
        type: typeInput.value,
        category: categoryInput.value,
        date
    };

    transactions.unshift(transaction);
    if (!saveTransactions()) {
        transactions.shift();
        return;
    }

    form.reset();
    dateInput.value = localDateString();
    renderApp();
});

searchInput.addEventListener("input", displayTransactions);
filterInput.addEventListener("change", displayTransactions);
monthPicker.addEventListener("change", updateCategoryBreakdown);
document.getElementById("exportCsv").addEventListener("click", exportTransactionsCsv);

document.getElementById("clearAll").addEventListener("click", () => {
    if (transactions.length === 0) {
        alert("There are no transactions to clear.");
        return;
    }
    if (!confirm("Delete all transactions? This cannot be undone.")) return;

    const previousTransactions = transactions;
    transactions = [];
    if (saveTransactions()) renderApp();
    else transactions = previousTransactions;
});

themeToggle.addEventListener("click", () => {
    const theme = document.body.classList.contains("light-theme") ? "dark" : "light";
    setTheme(theme);
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        console.error("Unable to save theme preference:", error);
    }
});

document.getElementById("currentDate").textContent = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
});
dateInput.value = localDateString();
dateInput.max = localDateString();
monthPicker.value = localDateString().slice(0, 7);

let savedTheme = "dark";
try {
    savedTheme = localStorage.getItem(THEME_KEY) || "dark";
} catch (error) {
    console.error("Unable to read theme preference:", error);
}
setTheme(savedTheme);
renderApp();
