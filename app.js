// Calculate button click handler
document.getElementById('calculate').addEventListener('click', async () => {
    const startDateInput = document.getElementById('startDate').value;
    const endDateInput = document.getElementById('endDate').value;
    const latitudeInput = document.getElementById('latitude').value;
    const longitudeInput = document.getElementById('longitude').value;
    const angleInput = document.getElementById('angle').value;
    
    // Validation
    if (!startDateInput || !endDateInput) {
        showError('Please select both start and end dates');
        return;
    }
    
    if (!latitudeInput || !longitudeInput) {
        showError('Please enter both latitude and longitude');
        return;
    }
    
    if (!angleInput) {
        showError('Please enter the twilight angle');
        return;
    }
    
    const latitude = parseFloat(latitudeInput);
    const longitude = parseFloat(longitudeInput);
    const angle = parseFloat(angleInput);
    
    // Validate coordinate ranges
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        showError('Latitude must be between -90 and 90 degrees');
        return;
    }
    
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        showError('Longitude must be between -180 and 180 degrees');
        return;
    }
    
    if (isNaN(angle)) {
        showError('Please enter a valid angle');
        return;
    }
    
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);
    
    if (startDate > endDate) {
        showError('Start date must be before or equal to end date');
        return;
    }
    
    // Calculate date range
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    if (daysDiff > 365) {
        showError('Date range cannot exceed 365 days');
        return;
    }
    
    showLoading(`Calculating ${daysDiff} days...`);
    hideError();
    hideTable();
    
    try {
        // Update angle label in table header
        document.getElementById('twilightAngleLabel').textContent = `(${angle}°)`;
        
        // Generate table data
        const tableData = [];
        const observer = new Astronomy.Observer(latitude, longitude, 0);
        
        for (let i = 0; i < daysDiff; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const dateStr = currentDate.toISOString().split('T')[0];
            
            try {
                const results = calculateDayTimes(dateStr, observer, angle);
                tableData.push({
                    date: dateStr,
                    twilight: results.twilight,
                    sunset: results.sunset
                });
            } catch (error) {
                tableData.push({
                    date: dateStr,
                    twilight: null,
                    sunset: null,
                    error: error.message
                });
            }
        }
        
        // Display table
        displayTable(tableData);
        hideLoading();
        
        // Show download button
        document.getElementById('downloadPdf').classList.remove('hidden');
    } catch (error) {
        hideLoading();
        showError(error.message || 'Failed to calculate times');
    }
});

// Download PDF button handler
document.getElementById('downloadPdf').addEventListener('click', () => {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;
    const angle = document.getElementById('angle').value;
    
    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    // Create a clean version for PDF
    const element = document.createElement('div');
    element.style.padding = '10px';
    element.style.background = '#fff';
    element.style.color = '#000';
    element.style.width = '100%';
    element.style.boxSizing = 'border-box';
    
    // Add header
    element.innerHTML = `
        <div style="text-align: center; margin-bottom: 10px;">
            <h1 style="font-size: 18px; margin: 0 0 6px 0; font-weight: 600;">Ramadan Fasting Times</h1>
            <p style="font-size: 10px; color: #666; margin: 0 0 3px 0;">Suhoor (Fajr) and Iftar (Sunset) Times</p>
            <p style="font-size: 9px; color: #666; margin: 0;">
                ${formatDate(startDate)} to ${formatDate(endDate)} (${daysDiff} days) | Location: ${latitude}°, ${longitude}° | Fajr Angle: ${angle}°
            </p>
        </div>
    `;
    
    // Clone and append the table
    const tableContainer = document.getElementById('tableContainer').cloneNode(true);
    tableContainer.classList.remove('hidden');
    
    // Style the table for PDF
    const table = tableContainer.querySelector('table');
    if (table) {
        table.style.width = '100%';
        table.style.fontSize = '8px';
        table.style.borderCollapse = 'collapse';
        
        // Style all cells
        const cells = table.querySelectorAll('th, td');
        cells.forEach(cell => {
            cell.style.padding = '4px 2px';
            cell.style.border = '1px solid #000';
            cell.style.textAlign = 'center';
        });
        
        // Style header
        const headers = table.querySelectorAll('th');
        headers.forEach(th => {
            th.style.background = '#000';
            th.style.color = '#fff';
            th.style.fontSize = '8px';
        });
        
        // Add page break class to rows for better pagination
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            row.style.pageBreakInside = 'avoid';
        });
    }
    
    element.appendChild(tableContainer);
    
    // Determine orientation based on number of days
    // Use landscape for large datasets to fit more columns comfortably
    const orientation = daysDiff > 60 ? 'landscape' : 'portrait';
    
    // PDF options - handles any number of rows with automatic pagination
    const opt = {
        margin: [8, 8, 8, 8],
        filename: `ramadan-fasting-times-${startDate}-to-${endDate}.pdf`,
        image: { 
            type: 'jpeg', 
            quality: 0.95 
        },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1200
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: orientation,
            compress: true
        },
        pagebreak: { 
            mode: ['avoid-all', 'css', 'legacy'],
            before: '.page-break-before',
            after: '.page-break-after',
            avoid: 'tr'
        }
    };
    
    // Generate PDF with automatic page handling
    html2pdf().set(opt).from(element).save();
});

// Calculate twilight and sunset times for a single day
function calculateDayTimes(dateStr, observer, angle) {
    const startTime = new Astronomy.MakeTime(new Date(dateStr + 'T00:00:00'));
    
    // Calculate twilight time (at specified angle)
    const twilightEvent = Astronomy.SearchAltitude(
        Astronomy.Body.Sun,
        observer,
        +1,  // direction: ascending
        startTime,
        1,   // search within 1 day
        angle
    );
    
    // Calculate sunset time
    const sunsetEvent = Astronomy.SearchRiseSet(
        Astronomy.Body.Sun,
        observer,
        -1,  // direction: setting
        startTime,
        1    // search within 1 day
    );
    
    if (!twilightEvent) {
        throw new Error('Twilight time not found');
    }
    
    if (!sunsetEvent) {
        throw new Error('Sunset time not found');
    }
    
    return {
        twilight: twilightEvent.date,
        sunset: sunsetEvent.date
    };
}

// Format time with milliseconds
function formatTimeWithMilliseconds(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Round twilight time DOWN (floor) - for Fajr safety
function roundTwilightDown(date) {
    const rounded = new Date(date);
    rounded.setSeconds(0);
    rounded.setMilliseconds(0);
    return rounded;
}

// Round sunset time UP (ceiling) - for Iftar safety
function roundSunsetUp(date) {
    const rounded = new Date(date);
    
    // If there are any seconds or milliseconds, round up to next minute
    if (date.getSeconds() > 0 || date.getMilliseconds() > 0) {
        rounded.setMinutes(date.getMinutes() + 1);
    }
    
    rounded.setSeconds(0);
    rounded.setMilliseconds(0);
    return rounded;
}

// Format rounded time (HH:MM:SS)
function formatRoundedTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Display table
function displayTable(tableData) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    tableData.forEach((row, index) => {
        const tr = document.createElement('tr');
        
        // Day number column (Ramadan day)
        const dayCell = document.createElement('td');
        dayCell.className = 'day-cell';
        dayCell.textContent = index + 1;
        tr.appendChild(dayCell);
        
        // Date column
        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(row.date);
        tr.appendChild(dateCell);
        
        // Actual Twilight time column
        const actualTwilightCell = document.createElement('td');
        actualTwilightCell.className = 'time-cell';
        if (row.twilight) {
            actualTwilightCell.textContent = formatTimeWithMilliseconds(row.twilight);
        } else {
            actualTwilightCell.textContent = 'N/A';
            actualTwilightCell.className = 'time-cell error-cell';
        }
        tr.appendChild(actualTwilightCell);
        
        // Actual Sunset time column
        const actualSunsetCell = document.createElement('td');
        actualSunsetCell.className = 'time-cell';
        if (row.sunset) {
            actualSunsetCell.textContent = formatTimeWithMilliseconds(row.sunset);
        } else {
            actualSunsetCell.textContent = 'N/A';
            actualSunsetCell.className = 'time-cell error-cell';
        }
        tr.appendChild(actualSunsetCell);
        
        // Rounded Twilight time column (rounded DOWN)
        const roundedTwilightCell = document.createElement('td');
        roundedTwilightCell.className = 'time-cell rounded-cell';
        if (row.twilight) {
            const roundedTwilight = roundTwilightDown(row.twilight);
            roundedTwilightCell.textContent = formatRoundedTime(roundedTwilight);
        } else {
            roundedTwilightCell.textContent = 'N/A';
            roundedTwilightCell.className = 'time-cell error-cell';
        }
        tr.appendChild(roundedTwilightCell);
        
        // Rounded Sunset time column (rounded UP)
        const roundedSunsetCell = document.createElement('td');
        roundedSunsetCell.className = 'time-cell rounded-cell';
        if (row.sunset) {
            const roundedSunset = roundSunsetUp(row.sunset);
            roundedSunsetCell.textContent = formatRoundedTime(roundedSunset);
        } else {
            roundedSunsetCell.textContent = 'N/A';
            roundedSunsetCell.className = 'time-cell error-cell';
        }
        tr.appendChild(roundedSunsetCell);
        
        tbody.appendChild(tr);
    });
    
    document.getElementById('tableContainer').classList.remove('hidden');
}

// UI helper functions
function showLoading(message = 'Loading...') {
    const loadingEl = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
        loadingText.textContent = message;
    }
    loadingEl.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function hideTable() {
    document.getElementById('tableContainer').classList.add('hidden');
    document.getElementById('downloadPdf').classList.add('hidden');
}

// Toggle info section
const infoToggle = document.getElementById('infoToggle');
const infoSection = document.getElementById('infoSection');

if (infoToggle && infoSection) {
    infoToggle.addEventListener('click', function() {
        if (infoSection.classList.contains('collapsed')) {
            infoSection.classList.remove('collapsed');
            infoSection.classList.add('expanded');
            infoToggle.classList.add('active');
        } else {
            infoSection.classList.remove('expanded');
            infoSection.classList.add('collapsed');
            infoToggle.classList.remove('active');
        }
    });
}

// Fetch GPS location button
const fetchGpsBtn = document.getElementById('fetchGps');
if (fetchGpsBtn) {
    fetchGpsBtn.addEventListener('click', async function() {
        if (!navigator.geolocation) {
            showError('Geolocation is not supported by your browser');
            return;
        }
        
        // Disable button and show loading state
        fetchGpsBtn.disabled = true;
        fetchGpsBtn.textContent = 'Getting precise location...';
        hideError();
        
        try {
            // Try to get multiple samples and use the best one
            let bestPosition = null;
            let attempts = 0;
            const maxAttempts = 3;
            
            const getPosition = () => {
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        resolve,
                        reject,
                        {
                            enableHighAccuracy: true,
                            timeout: 15000,
                            maximumAge: 0
                        }
                    );
                });
            };
            
            // Try to get better accuracy with multiple attempts
            while (attempts < maxAttempts) {
                try {
                    const position = await getPosition();
                    
                    if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                        bestPosition = position;
                    }
                    
                    // If we get good accuracy (< 50m), stop trying
                    if (position.coords.accuracy < 50) {
                        break;
                    }
                    
                    attempts++;
                    if (attempts < maxAttempts) {
                        fetchGpsBtn.textContent = `Refining... (${attempts}/${maxAttempts})`;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (err) {
                    if (attempts === 0) throw err; // If first attempt fails, throw error
                    break; // Otherwise use what we have
                }
            }
            
            if (!bestPosition) {
                throw new Error('Could not get location');
            }
            
            const { latitude, longitude, accuracy } = bestPosition.coords;
            
            // Update input fields
            document.getElementById('latitude').value = latitude.toFixed(8);
            document.getElementById('longitude').value = longitude.toFixed(8);
            
            // Format accuracy message
            let accuracyMsg;
            if (accuracy < 1000) {
                accuracyMsg = `±${Math.round(accuracy)}m`;
            } else {
                accuracyMsg = `±${(accuracy / 1000).toFixed(1)}km`;
            }
            
            // Show success message with accuracy warning if needed
            if (accuracy > 1000) {
                fetchGpsBtn.textContent = `Low accuracy ${accuracyMsg}`;
                showError(`Location found but accuracy is low (${accuracyMsg}). For better results, enable GPS and try outdoors.`);
            } else if (accuracy > 100) {
                fetchGpsBtn.textContent = `Found ${accuracyMsg}`;
            } else {
                fetchGpsBtn.textContent = `Precise location ${accuracyMsg}`;
            }
            
            setTimeout(() => {
                fetchGpsBtn.textContent = 'Get My GPS Location';
                fetchGpsBtn.disabled = false;
            }, 4000);
            
        } catch (error) {
            let message = 'Unable to retrieve your location';
            
            if (error.code === 1) {
                message = 'Location permission denied. Please enable location access in your browser settings.';
            } else if (error.code === 2) {
                message = 'Location information unavailable. Make sure GPS is enabled.';
            } else if (error.code === 3) {
                message = 'Location request timed out. Please try again.';
            }
            
            showError(message);
            fetchGpsBtn.textContent = 'Get My GPS Location';
            fetchGpsBtn.disabled = false;
        }
    });
}
