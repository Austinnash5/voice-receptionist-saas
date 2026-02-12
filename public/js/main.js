// Main JavaScript file for AI Voice Receptionist

document.addEventListener('DOMContentLoaded', function() {
  console.log('AI Voice Receptionist loaded');

  // Confirm delete actions
  const deleteButtons = document.querySelectorAll('button[data-confirm]');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      const message = this.getAttribute('data-confirm') || 'Are you sure?';
      if (!confirm(message)) {
        e.preventDefault();
      }
    });
  });

  // Auto-hide flash messages
  const flashMessages = document.querySelectorAll('.flash-message');
  flashMessages.forEach(message => {
    setTimeout(() => {
      message.style.opacity = '0';
      setTimeout(() => message.remove(), 300);
    }, 5000);
  });

  // Table row click (make entire row clickable)
  const clickableRows = document.querySelectorAll('tr[data-href]');
  clickableRows.forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', function() {
      window.location.href = this.getAttribute('data-href');
    });
  });

  // Format phone numbers
  const phoneElements = document.querySelectorAll('[data-phone]');
  phoneElements.forEach(el => {
    const phone = el.textContent.trim();
    if (phone.match(/^\+1\d{10}$/)) {
      const formatted = phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3');
      el.textContent = formatted;
    }
  });

  // Real-time form validation
  const forms = document.querySelectorAll('form[data-validate]');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      let isValid = true;
      
      const requiredInputs = form.querySelectorAll('[required]');
      requiredInputs.forEach(input => {
        if (!input.value.trim()) {
          isValid = false;
          input.classList.add('error');
        } else {
          input.classList.remove('error');
        }
      });

      if (!isValid) {
        e.preventDefault();
        alert('Please fill in all required fields');
      }
    });
  });

  // Status badge colors
  updateStatusBadges();
});

function updateStatusBadges() {
  const badges = document.querySelectorAll('.badge');
  badges.forEach(badge => {
    const text = badge.textContent.trim().toLowerCase();
    
    if (text.includes('active') || text.includes('completed') || text.includes('success')) {
      badge.style.background = '#d4edda';
      badge.style.color = '#155724';
    } else if (text.includes('pending') || text.includes('progress')) {
      badge.style.background = '#fff3cd';
      badge.style.color = '#856404';
    } else if (text.includes('failed') || text.includes('error') || text.includes('inactive')) {
      badge.style.background = '#f8d7da';
      badge.style.color = '#721c24';
    }
  });
}

// Utility functions
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatPhoneNumber(phone) {
  if (phone.match(/^\+1\d{10}$/)) {
    return phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3');
  }
  return phone;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}
