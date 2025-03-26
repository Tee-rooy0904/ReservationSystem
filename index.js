window.addEventListener('load', function() {
    // Add device detection at the start
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Existing date input code...
    const dateInput = document.getElementById('date');
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];
    dateInput.setAttribute('min', minDate);
    dateInput.value = minDate;

    // Adjust time input for mobile
    const timeInput = document.getElementById('time');
    if (isMobile) {
        timeInput.setAttribute('step', '900');
    }

    // Prevent manual date entry and past date selection
    dateInput.addEventListener('input', function(e) {
        const selectedDate = new Date(this.value);
        if (selectedDate < today) {
            this.value = minDate;
        }
    });
    const form = document.getElementById('reservationForm');
    const submitButton = form.querySelector('button[type="submit"]');
    const idInput = document.getElementById('idNo');
    const roleSelect = document.getElementById('role');

    // Enable ID input if role is already selected
    if (roleSelect.value) {
        idInput.disabled = false;
        idInput.placeholder = roleSelect.value === 'personnel' ? 
            'Enter 3-digit ID number' : 
            'Enter 9-10 digit ID number';
    }

    roleSelect.addEventListener('change', function() {
        if (this.value) {
            idInput.disabled = false;
            idInput.value = '';
            idInput.placeholder = this.value === 'personnel' ? 
                'Enter 3-digit ID number' : 
                'Enter 9-10 digit ID number';
        } else {
            idInput.disabled = true;
            idInput.value = '';
        }
    });

    // Modified validateForm function with mobile support
    const validateForm = () => {
        const role = document.getElementById('role').value;
        const idNo = document.getElementById('idNo').value.trim();
        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;

        const isValidId = role === 'personnel' ? 
            /^\d{3}$/.test(idNo) : 
            /^\d{9,10}$/.test(idNo);

        const isValidPhone = /^\d{10}$/.test(phone);

        // Add touch-friendly validation messages
        const errors = [];
        if (!role) errors.push('Please select a role');
        if (!isValidId) errors.push('Please enter a valid ID number');
        if (!fullName) errors.push('Please enter your full name');
        if (!isValidPhone) errors.push('Please enter a valid 10-digit phone number');
        if (!date) errors.push('Please select a date');
        if (!time) errors.push('Please select a time');

        if (errors.length > 0) {
            if (isMobile) {
                alert(errors.join('\n'));
            }
            submitButton.classList.remove('btn-success');
            submitButton.classList.add('btn-danger');
            return false;
        }

        submitButton.classList.remove('btn-danger');
        submitButton.classList.add('btn-success');
        return true;
    };

    const formInputs = form.querySelectorAll('input, select');
    formInputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('change', validateForm);
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            alert('Please fill in all required fields');
            return;
        }

        const formData = {
            role: document.getElementById('role').value,
            idNo: document.getElementById('idNo').value,
            fullName: document.getElementById('fullName').value,
            sex: document.getElementById('sex').value,
            phone: document.getElementById('phone').value,
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            equipments: Array.from(document.querySelectorAll('input[name="equipment"]:checked'))
                    .map(checkbox => checkbox.value)
                    .join(', '),
            status: 'pending'
        };
    
        // Save to localStorage
        const existingReservations = JSON.parse(localStorage.getItem('reservations')) || [];
        existingReservations.push(formData);
        localStorage.setItem('reservations', JSON.stringify(existingReservations));
    
        // Show overlay and update initial status
        const overlay = document.getElementById('scanOverlay');
        if (isMobile) {
            overlay.addEventListener('touchmove', function(e) {
                e.preventDefault(); // Prevent scrolling behind overlay on mobile
            }, { passive: false });
        }
        overlay.style.display = 'flex';
        updateBookingStatus('pending');
        
        // Check reservation status periodically
        const checkStatus = setInterval(() => {
            const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
            const currentReservation = reservations.find(r => 
                r.idNo === formData.idNo && 
                r.date === formData.date && 
                r.time === formData.time
            );
            
            if (currentReservation && currentReservation.status === 'approved') {
                updateBookingStatus('approved');
                clearInterval(checkStatus);
            }
        }, 2000); // Check every 2 seconds
    });

    const closeButton = document.querySelector('.close-btn');
    if (closeButton) {
        closeButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            document.getElementById('scanOverlay').style.display = 'none';
            
            const qrcodeContainer = document.getElementById('qrcode');
            if (qrcodeContainer) {
                qrcodeContainer.innerHTML = '';
            }
            
            // Refresh the page
            window.location.reload();
        });
    }
});


// Add this function to check equipment availability
function checkEquipmentAvailability(date, time) {
    const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
    const unavailableEquipments = new Set();
    
    const selectedDateTime = new Date(`${date} ${time}`);
    const selectedTime = selectedDateTime.getTime();
    
    reservations.forEach(reservation => {
        const reservationDateTime = new Date(`${reservation.date} ${reservation.time}`);
        const reservationTime = reservationDateTime.getTime();
        
        // Calculate time difference in hours
        const timeDiff = Math.abs(selectedTime - reservationTime) / (1000 * 60 * 60);
        
        // If within 3 hours before or after
        if (timeDiff <= 3) {
            const equipments = reservation.equipments ? reservation.equipments.split(', ') : [];
            equipments.forEach(eq => unavailableEquipments.add(eq));
        }
    });
    
    return unavailableEquipments;
}

function updateEquipmentAvailability() {
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    
    if (date && time) {
        const unavailableEquipments = checkEquipmentAvailability(date, time);
        const checkboxes = document.querySelectorAll('input[name="equipment"]');
        
        checkboxes.forEach(checkbox => {
            if (unavailableEquipments.has(checkbox.value)) {
                checkbox.disabled = true;
                checkbox.checked = false;
                
                let alertSpan = checkbox.nextElementSibling.nextElementSibling;
                if (!alertSpan || !alertSpan.classList.contains('text-danger')) {
                    alertSpan = document.createElement('span');
                    alertSpan.className = 'text-danger ml-2';
                    alertSpan.style.fontSize = '12px';
                    checkbox.parentNode.insertBefore(alertSpan, checkbox.nextElementSibling.nextSibling);
                }
                alertSpan.textContent = '(Not available - Reserved within 3 hours)';
            } else {
                checkbox.disabled = false;
                
                const alertSpan = checkbox.nextElementSibling.nextElementSibling;
                if (alertSpan && alertSpan.classList.contains('text-danger')) {
                    alertSpan.remove();
                }
            }
        });
    }
}

// Add event listeners for date and time inputs
document.getElementById('date').addEventListener('change', updateEquipmentAvailability);
document.getElementById('time').addEventListener('change', updateEquipmentAvailability);


function updateBookingStatus(status) {
    const pendingStatus = document.getElementById('pendingStatus');
    const approvedStatus = document.getElementById('approvedStatus');
    
    if (status === 'approved') {
        pendingStatus.style.display = 'none';
        approvedStatus.style.display = 'flex';
    } else {
        pendingStatus.style.display = 'flex';
        approvedStatus.style.display = 'none';
    }
}