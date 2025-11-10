// REPLACE WITH YOUR ACTUAL SUPABASE CREDENTIALS
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

  async getPreps() {
    return this.request("preps?active=eq.true&order=task");
  }

  async addPrep(prep) {
    return this.request("preps", "POST", prep);
  }

  async updatePrep(id, data) {
    return this.request(`preps?id=eq.${id}`, "PATCH", data);
  }

  async deletePrep(id) {
    return this.request(`preps?id=eq.${id}`, "PATCH", { active: false });
  }

  async getDailyPrepsForPrep(prepId) {
    return this.request(
      `daily_preps?prep_id=eq.${prepId}&select=day_of_week,quantity`
    );
  }

  async assignPrepToDays(prepId, dayAssignments) {
    await this.request(`daily_preps?prep_id=eq.${prepId}`, "DELETE");

    if (dayAssignments.length > 0) {
      const assignments = dayAssignments.map((assignment) => ({
        prep_id: prepId,
        day_of_week: assignment.day,
        quantity: assignment.quantity,
      }));

      return this.request("daily_preps", "POST", assignments);
    }
  }
}

class AdminApp {
  constructor() {
    this.api = new SupabaseAPI(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.preps = [];
    this.dayNames = [
      "",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadPreps();
    this.renderDayAssignmentGrid();
  }

  setupEventListeners() {
    document.getElementById("addPrepForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAddPrep();
    });

    document.getElementById("prepSelect").addEventListener("change", (e) => {
      this.loadPrepDays(e.target.value);
    });

    document.getElementById("assignDaysBtn").addEventListener("click", () => {
      this.handleAssignDays();
    });
  }

  async handleAddPrep() {
    const task = document.getElementById("prepTask").value;
    const instructions = document.getElementById("prepInstructions").value;

    try {
      await this.api.addPrep({ task, instructions });
      document.getElementById("addPrepForm").reset();
      await this.loadPreps();
      alert("Prep added successfully!");
    } catch (error) {
      alert("Error adding prep: " + error.message);
    }
  }

  async loadPreps() {
    try {
      this.preps = await this.api.getPreps();
      this.renderPreps();
      this.populatePrepSelect();
    } catch (error) {
      console.error("Error loading preps:", error);
    }
  }

  renderPreps() {
    const container = document.getElementById("prepsList");

    if (this.preps.length === 0) {
      container.innerHTML =
        "<p>No preps available. Add your first prep above.</p>";
      return;
    }

    container.innerHTML = this.preps
      .map(
        (prep) => `
            <div class="prep-item" id="prep-${prep.id}">
                <div class="prep-header">
                    <div class="prep-info">
                        <div class="prep-task">${prep.task}</div>
                        ${
                          prep.instructions
                            ? `<div class="prep-instructions">${prep.instructions}</div>`
                            : ""
                        }
                    </div>
                    <div class="prep-actions">
                        <button class="small" onclick="adminApp.toggleEdit(${
                          prep.id
                        })">Edit</button>
                        <button class="small danger" onclick="adminApp.deletePrep(${
                          prep.id
                        })">Delete</button>
                    </div>
                </div>
                
                <div class="edit-form" id="edit-${prep.id}">
                    <input type="text" id="edit-task-${prep.id}" value="${
          prep.task
        }" placeholder="Task">
                    <textarea id="edit-instructions-${
                      prep.id
                    }" placeholder="Instructions" rows="3">${
          prep.instructions || ""
        }</textarea>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="adminApp.saveEdit(${
                          prep.id
                        })">Save</button>
                        <button class="danger" onclick="adminApp.toggleEdit(${
                          prep.id
                        })">Cancel</button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  }

  populatePrepSelect() {
    const select = document.getElementById("prepSelect");
    select.innerHTML =
      '<option value="">Select a prep</option>' +
      this.preps
        .map((prep) => `<option value="${prep.id}">${prep.task}</option>`)
        .join("");
  }

  renderDayAssignmentGrid() {
    const container = document.getElementById("dayAssignmentGrid");

    container.innerHTML = [1, 2, 3, 4, 5, 6, 7]
      .map(
        (day) => `
            <div class="day-assignment-item">
                <input type="checkbox" id="day-check-${day}" value="${day}" 
                    onchange="adminApp.toggleQuantityInput(${day})">
                <label for="day-check-${day}">${this.dayNames[day]}</label>
                <input type="text" id="day-quantity-${day}" 
                    placeholder="e.g., 4 containers, 2 trays" 
                    disabled>
            </div>
        `
      )
      .join("");
  }

  toggleQuantityInput(day) {
    const checkbox = document.getElementById(`day-check-${day}`);
    const quantityInput = document.getElementById(`day-quantity-${day}`);

    quantityInput.disabled = !checkbox.checked;
    if (!checkbox.checked) {
      quantityInput.value = "";
    }
  }

  toggleEdit(prepId) {
    const editForm = document.getElementById(`edit-${prepId}`);
    editForm.classList.toggle("active");
  }

  async saveEdit(prepId) {
    const task = document.getElementById(`edit-task-${prepId}`).value;
    const instructions = document.getElementById(
      `edit-instructions-${prepId}`
    ).value;

    try {
      await this.api.updatePrep(prepId, { task, instructions });
      await this.loadPreps();
      alert("Prep updated successfully!");
    } catch (error) {
      alert("Error updating prep: " + error.message);
    }
  }

  async deletePrep(prepId) {
    if (!confirm("Are you sure you want to delete this prep?")) {
      return;
    }

    try {
      await this.api.deletePrep(prepId);
      await this.loadPreps();
      alert("Prep deleted successfully!");
    } catch (error) {
      alert("Error deleting prep: " + error.message);
    }
  }

  async loadPrepDays(prepId) {
    if (!prepId) {
      for (let day = 1; day <= 7; day++) {
        document.getElementById(`day-check-${day}`).checked = false;
        document.getElementById(`day-quantity-${day}`).value = "";
        document.getElementById(`day-quantity-${day}`).disabled = true;
      }
      return;
    }

    try {
      const dailyPreps = await this.api.getDailyPrepsForPrep(prepId);

      for (let day = 1; day <= 7; day++) {
        document.getElementById(`day-check-${day}`).checked = false;
        document.getElementById(`day-quantity-${day}`).value = "";
        document.getElementById(`day-quantity-${day}`).disabled = true;
      }

      dailyPreps.forEach((dp) => {
        document.getElementById(`day-check-${dp.day_of_week}`).checked = true;
        document.getElementById(`day-quantity-${dp.day_of_week}`).value =
          dp.quantity;
        document.getElementById(
          `day-quantity-${dp.day_of_week}`
        ).disabled = false;
      });
    } catch (error) {
      console.error("Error loading prep days:", error);
    }
  }

  async handleAssignDays() {
    const prepId = document.getElementById("prepSelect").value;

    if (!prepId) {
      alert("Please select a prep first");
      return;
    }

    const dayAssignments = [];

    for (let day = 1; day <= 7; day++) {
      const checkbox = document.getElementById(`day-check-${day}`);
      const quantityInput = document.getElementById(`day-quantity-${day}`);

      if (checkbox.checked) {
        const quantity = quantityInput.value.trim();

        if (!quantity) {
          alert(`Please enter a quantity for ${this.dayNames[day]}`);
          return;
        }

        dayAssignments.push({
          day: day,
          quantity: quantity,
        });
      }
    }

    try {
      await this.api.assignPrepToDays(prepId, dayAssignments);
      alert("Days and quantities updated successfully!");
    } catch (error) {
      alert("Error updating days: " + error.message);
    }
  }
}

let adminApp;
document.addEventListener("DOMContentLoaded", () => {
  adminApp = new AdminApp();
});
