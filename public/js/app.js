/**
 * Aplicação Central (Motor MPA)
 * Controle de navegação dinâmico e retenção de estado.
 */

// A const syllabus é injetada via js/data.js gerado no build.js

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();

  if (document.body.dataset.page === 'dashboard') {
    renderHomeCards();
  }

  initCheckboxes();
});

function initCheckboxes() {
  const completedLessons = JSON.parse(localStorage.getItem('completedLessons') || '[]');
  const currentPageId = document.body.dataset.id || "dashboard";
  
  const checkbox = document.getElementById('mark-completed');
  if (checkbox) {
    if (completedLessons.includes(currentPageId)) {
      checkbox.checked = true;
    }
    
    checkbox.addEventListener('change', (e) => {
      let lessons = JSON.parse(localStorage.getItem('completedLessons') || '[]');
      if (e.target.checked) {
        if (!lessons.includes(currentPageId)) lessons.push(currentPageId);
      } else {
        lessons = lessons.filter(id => id !== currentPageId);
      }
      localStorage.setItem('completedLessons', JSON.stringify(lessons));
      
      // Update sidebar visual if needed
      renderSidebar();
    });
  }
}

function renderSidebar() {
  const sidebarContainer = document.getElementById('sidebar-menu');
  if(!sidebarContainer) return;

  const completedLessons = JSON.parse(localStorage.getItem('completedLessons') || '[]');
  let currentBlock = "";
  let html = "";

  const currentPageId = document.body.dataset.id || "dashboard";

  html += `
    <div class="menu-block">
      <a href="index.html" class="menu-item ${currentPageId === 'dashboard' || currentPageId === 'index' ? 'active' : ''}">
        🏠 Dashboard Curricular
      </a>
    </div>
  `;

  if (typeof syllabus !== 'undefined') {
    syllabus.forEach(lesson => {
      if (lesson.block !== currentBlock && lesson.block) {
        currentBlock = lesson.block;
        html += `
          <div class="menu-block">
            <div class="menu-block-title">${currentBlock}</div>
        `;
      }

      const isCompleted = completedLessons.includes(lesson.id);
      html += `
        <a href="${lesson.id}.html" class="menu-item ${currentPageId === lesson.id ? 'active' : ''}">
          ${isCompleted ? '✅ ' : ''}${lesson.title}
        </a>
      `;

      const nextLesson = syllabus[syllabus.indexOf(lesson) + 1];
      if (!nextLesson || nextLesson.block !== currentBlock) {
        html += `</div>`;
      }
    });
  }

  if (typeof attachments !== 'undefined' && attachments.length > 0) {
    html += `
      <div class="menu-block">
        <div class="menu-block-title">Material Complementar</div>
    `;
    attachments.forEach(att => {
      html += `
        <a href="${att.url}" target="_blank" class="menu-item">
          📎 ${att.text}
        </a>
      `;
    });
    html += `</div>`;
  }

  sidebarContainer.innerHTML = html;
}

function renderHomeCards() {
  const container = document.getElementById('syllabus-cards-container');
  if(!container) return;

  const completedLessons = JSON.parse(localStorage.getItem('completedLessons') || '[]');
  let currentBlock = "";
  let blockLessonsHtml = "";
  let html = "";

  if (typeof syllabus !== 'undefined') {
    syllabus.forEach((lesson, index) => {
      if (lesson.block !== currentBlock) {
        if (currentBlock !== "") {
          html += `
            <div class="card">
              <h3 class="card-title">📚 ${currentBlock}</h3>
              <ul class="capabilities-list">
                ${blockLessonsHtml}
              </ul>
            </div>
          `;
          blockLessonsHtml = "";
        }
        currentBlock = lesson.block || 'Aulas';
      }

      const isCompleted = completedLessons.includes(lesson.id);
      blockLessonsHtml += `<li><a href="${lesson.id}.html" style="text-decoration:none; color:inherit;"><strong>${lesson.id.toUpperCase().replace('-', ' ')}:</strong> ${lesson.title} ${isCompleted ? '✅' : ''}</a></li>`;

      if (index === syllabus.length - 1) {
        html += `
          <div class="card">
            <h3 class="card-title">📚 ${currentBlock}</h3>
            <ul class="capabilities-list">
              ${blockLessonsHtml}
            </ul>
          </div>
        `;
      }
    });
  }

  container.innerHTML = html;
}
