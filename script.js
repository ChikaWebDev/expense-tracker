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
                    /^\d{4}-\d{2}-\d{2}$/.test(transaction.date.slice(0, 10))
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
    if (!description || !Number.isFinite(amount) || amount <= 0 || !date) {
        alert("Please enter a valid description, amount, and date.");
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

let savedTheme = "dark";
try {
    savedTheme = localStorage.getItem(THEME_KEY) || "dark";
} catch (error) {
    console.error("Unable to read theme preference:", error);
}
setTheme(savedTheme);
renderApp();
