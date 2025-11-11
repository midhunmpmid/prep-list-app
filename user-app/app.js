// REPLACE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

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
      `daily_preps?day_of_week=eq.${dayOfWeek}&preps.active=eq.true&select=*,preps!inner(*)&order=preps(order_position).asc`
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

  async updatePrepOrderPosition(prepId, newPosition) {
    return this.request(`preps?id=eq.${prepId}`, "PATCH", {
      order_position: newPosition,
    });
  }
}

class PrepListApp {
  constructor() {
    this.api = new SupabaseAPI(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.currentDay = this.getTodayDay();
    this.currentDate = this.getTodayDate();
    this.completions = new Set();
    this.dailyPreps = [];
    this.draggedElement = null;
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

      this.dailyPreps = dailyPreps;
      this.completions = new Set(completions.map((c) => c.daily_prep_id));

      loading.style.display = "none";

      if (dailyPreps.length === 0) {
        emptyState.style.display = "block";
        return;
      }

      prepTable.style.display = "flex";
      this.renderPreps(dailyPreps);
      this.setupDragAndDrop();
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
                <div class="prep-row ${isCompleted ? "completed" : ""}" 
                     data-id="${dp.id}" 
                     data-daily-prep-id="${dp.id}"
                     data-prep-id="${prep.id}"
                     draggable="true">
                    <div class="drag-handle">☰</div>
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

  setupDragAndDrop() {
    const prepRows = document.querySelectorAll(".prep-row");

    prepRows.forEach((row) => {
      // Desktop drag events
      row.addEventListener("dragstart", (e) => this.handleDragStart(e));
      row.addEventListener("dragend", (e) => this.handleDragEnd(e));
      row.addEventListener("dragover", (e) => this.handleDragOver(e));
      row.addEventListener("drop", (e) => this.handleDrop(e));
      row.addEventListener("dragenter", (e) => this.handleDragEnter(e));
      row.addEventListener("dragleave", (e) => this.handleDragLeave(e));

      // Touch events for mobile/tablet
      row.addEventListener("touchstart", (e) => this.handleTouchStart(e), {
        passive: false,
      });
      row.addEventListener("touchmove", (e) => this.handleTouchMove(e), {
        passive: false,
      });
      row.addEventListener("touchend", (e) => this.handleTouchEnd(e), {
        passive: false,
      });
    });
  }

  handleDragStart(e) {
    this.draggedElement = e.target;
    e.target.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target.innerHTML);
  }

  handleDragEnd(e) {
    e.target.classList.remove("dragging");
    document.querySelectorAll(".prep-row").forEach((row) => {
      row.classList.remove("drag-over");
    });
  }

  handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = "move";
    return false;
  }

  handleDragEnter(e) {
    if (e.target.classList.contains("prep-row")) {
      e.target.classList.add("drag-over");
    }
  }

  handleDragLeave(e) {
    if (e.target.classList.contains("prep-row")) {
      e.target.classList.remove("drag-over");
    }
  }

  async handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();

    if (
      this.draggedElement !== e.target &&
      e.target.classList.contains("prep-row")
    ) {
      await this.reorderPreps(this.draggedElement, e.target);
    }

    return false;
  }

  // Touch event handlers for mobile/tablet
  handleTouchStart(e) {
    const touch = e.touches[0];
    this.draggedElement = e.currentTarget;
    this.touchStartY = touch.clientY;
    this.initialY = this.draggedElement.offsetTop;

    // Add visual feedback after short delay (long press)
    this.longPressTimer = setTimeout(() => {
      this.draggedElement.classList.add("dragging");
      this.isDragging = true;
    }, 200);
  }

  handleTouchMove(e) {
    if (!this.isDragging) {
      clearTimeout(this.longPressTimer);
      return;
    }

    e.preventDefault();
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = currentY - this.touchStartY;

    // Move the element
    this.draggedElement.style.transform = `translateY(${deltaY}px)`;
    this.draggedElement.style.zIndex = "1000";

    // Find element under touch
    const elementBelow = document.elementFromPoint(
      touch.clientX,
      touch.clientY
    );
    const rowBelow = elementBelow?.closest(".prep-row");

    // Remove previous highlights
    document.querySelectorAll(".prep-row").forEach((row) => {
      if (row !== this.draggedElement) {
        row.classList.remove("drag-over");
      }
    });

    // Highlight target row
    if (rowBelow && rowBelow !== this.draggedElement) {
      rowBelow.classList.add("drag-over");
      this.dropTarget = rowBelow;
    }
  }

  async handleTouchEnd(e) {
    clearTimeout(this.longPressTimer);

    if (!this.isDragging) {
      return;
    }

    e.preventDefault();
    this.isDragging = false;

    // Reset styles
    this.draggedElement.style.transform = "";
    this.draggedElement.style.zIndex = "";
    this.draggedElement.classList.remove("dragging");

    // Remove highlights
    document.querySelectorAll(".prep-row").forEach((row) => {
      row.classList.remove("drag-over");
    });

    // Perform reorder if there's a valid drop target
    if (this.dropTarget && this.dropTarget !== this.draggedElement) {
      await this.reorderPreps(this.draggedElement, this.dropTarget);
    }

    this.dropTarget = null;
    this.draggedElement = null;
  }

  async reorderPreps(draggedRow, targetRow) {
    const draggedPrepId = parseInt(draggedRow.dataset.prepId);
    const targetPrepId = parseInt(targetRow.dataset.prepId);

    // Find indices in current array
    const draggedIndex = this.dailyPreps.findIndex(
      (dp) => dp.preps.id === draggedPrepId
    );
    const targetIndex = this.dailyPreps.findIndex(
      (dp) => dp.preps.id === targetPrepId
    );

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder local array
    const [removed] = this.dailyPreps.splice(draggedIndex, 1);
    this.dailyPreps.splice(targetIndex, 0, removed);

    // Update order positions in preps table (global order)
    try {
      const updates = this.dailyPreps.map((dp, index) =>
        this.api.updatePrepOrderPosition(dp.preps.id, index)
      );

      await Promise.all(updates);

      // Re-render with new order
      this.renderPreps(this.dailyPreps);
      this.setupDragAndDrop();

      // Show confirmation message
      this.showToast("Order updated across all days");
    } catch (error) {
      console.error("Error updating order:", error);
      alert("Failed to save new order. Please try again.");
      // Reload to get correct order from database
      await this.loadPreps(this.currentDay);
    }
  }

  showToast(message) {
    // Create toast element if it doesn't exist
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 2000);
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
