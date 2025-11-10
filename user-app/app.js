const SUPABASE_URL = "https://togesremedrrfhtpxaxm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZ2VzcmVtZWRycmZodHB4YXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjQ2NzQsImV4cCI6MjA3ODIwMDY3NH0.OTMB3aO8Go3QaANi1zLOZUDP_503283v07KZ5h7OnvU";

class SupabaseAPI {
  constructor(url, key) {
    this.url = url;
    this.headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }

  async request(endpoint, method = "GET", data = null) {
    const config = {
      method,
      headers: this.headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.url}/rest/v1/${endpoint}`, config);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    if (method === "DELETE") {
      return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async getDailyPreps(dayOfWeek) {
    return this.request(
      `daily_preps?day_of_week=eq.${dayOfWeek}&preps.active=eq.true&select=*,preps!inner(*)&order=preps(task)`
    );
  }

  async getCompletions(date) {
    return this.request(
      `prep_completions?completed_date=eq.${date}&select=daily_prep_id`
    );
  }

  async markComplete(dailyPrepId, date) {
    return this.request("prep_completions", "POST", {
      daily_prep_id: dailyPrepId,
      completed_date: date,
    });
  }

  async markIncomplete(dailyPrepId, date) {
    return this.request(
      `prep_completions?daily_prep_id=eq.${dailyPrepId}&completed_date=eq.${date}`,
      "DELETE"
    );
  }
}

class PrepListApp {
  constructor() {
    this.api = new SupabaseAPI(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.currentDay = this.getTodayDay();
    this.currentDate = this.getTodayDate();
    this.completions = new Set();
    this.init();
  }

  getTodayDay() {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }

  getTodayDate() {
    return new Date().toISOString().split("T")[0];
  }

  async init() {
    this.displayCurrentDate();
    this.setupEventListeners();
    this.setActiveDay(this.currentDay);
    await this.loadPreps(this.currentDay);
  }

  displayCurrentDate() {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const dateStr = new Date().toLocaleDateString("en-US", options);
    document.getElementById("currentDate").textContent = dateStr;
  }

  setupEventListeners() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const day = parseInt(tab.dataset.day);
        this.setActiveDay(day);
        this.loadPreps(day);
      });
    });
  }

  setActiveDay(day) {
    this.currentDay = day;
    document.querySelectorAll(".tab-btn").forEach((tab) => {
      tab.classList.toggle("active", parseInt(tab.dataset.day) === day);
    });
  }

  async loadPreps(dayOfWeek) {
    const loading = document.getElementById("loading");
    const prepTable = document.getElementById("prepTable");
    const emptyState = document.getElementById("emptyState");
    const errorDiv = document.getElementById("error");

    try {
      loading.style.display = "block";
      prepTable.style.display = "none";
      emptyState.style.display = "none";
      errorDiv.style.display = "none";

      const [dailyPreps, completions] = await Promise.all([
        this.api.getDailyPreps(dayOfWeek),
        this.api.getCompletions(this.currentDate),
      ]);

      this.completions = new Set(completions.map((c) => c.daily_prep_id));

      loading.style.display = "none";

      if (dailyPreps.length === 0) {
        emptyState.style.display = "block";
        return;
      }

      prepTable.style.display = "flex";
      this.renderPreps(dailyPreps);
    } catch (error) {
      loading.style.display = "none";
      errorDiv.textContent = "Error loading preps: " + error.message;
      errorDiv.style.display = "block";
      console.error("Error:", error);
    }
  }

  renderPreps(dailyPreps) {
    const prepList = document.getElementById("prepList");

    prepList.innerHTML = dailyPreps
      .map((dp) => {
        const prep = dp.preps;
        const isCompleted = this.completions.has(dp.id);

        return `
                <div class="prep-row ${
                  isCompleted ? "completed" : ""
                }" data-id="${dp.id}">
                    <div class="col-checkbox">
                        <input 
                            type="checkbox" 
                            ${isCompleted ? "checked" : ""}
                            data-daily-prep-id="${dp.id}"
                        >
                    </div>
                    <div class="prep-task">${prep.task}</div>
                    <div class="prep-quantity">${dp.quantity}</div>
                    <div class="prep-instructions">${
                      prep.instructions || "-"
                    }</div>
                </div>
            `;
      })
      .join("");

    const checkboxes = prepList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => this.handleCheckboxChange(e));
    });
  }

  async handleCheckboxChange(event) {
    const checkbox = event.target;
    const dailyPrepId = parseInt(checkbox.dataset.dailyPrepId);
    const prepRow = checkbox.closest(".prep-row");

    try {
      checkbox.disabled = true;

      if (checkbox.checked) {
        await this.api.markComplete(dailyPrepId, this.currentDate);
        this.completions.add(dailyPrepId);
        prepRow.classList.add("completed");
      } else {
        await this.api.markIncomplete(dailyPrepId, this.currentDate);
        this.completions.delete(dailyPrepId);
        prepRow.classList.remove("completed");
      }
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      alert("Error updating completion status: " + error.message);
    } finally {
      checkbox.disabled = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PrepListApp();
});
