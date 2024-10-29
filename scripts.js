/* scripts.js */

// Attach initMap to the window object to make it globally accessible
window.initMap = initMap;

// Declare global variables
var map;
var markers = [];
var allLocations = [];
var selectedMarker = null;
var panorama;
var isStreetViewVisible = false;
var infoWindow;

// Initialize the map
function initMap() {
    var center = { lat: 51.3992, lng: -3.2835 };

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: center,
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.BOTTOM_LEFT
        },
        gestureHandling: 'greedy' // Allow gestures on mobile
    });

    // Initialize Street View Panorama
    panorama = new google.maps.StreetViewPanorama(
        document.getElementById('map'), {
            addressControl: false,
            linksControl: false,
            visible: false
        }
    );

    map.setStreetView(panorama);

    // Initialize InfoWindow
    infoWindow = new google.maps.InfoWindow();

    // Fetch location data from locations.json
    fetch('locations.json')
        .then(response => response.json())
        .then(locations => {
            allLocations = locations;

            // Generate unique area list for the area filters
            var areaSet = new Set();

            allLocations.forEach(location => {
                if (location.area) {
                    areaSet.add(location.area);
                }
            });

            var areaList = Array.from(areaSet).sort();

            // Populate the area filters
            populateFilters('#area-filter', areaList);
            populateFilters('#area-filter-mobile', areaList);

            // Initially populate episode filters with all episodes
            updateEpisodeFilterOptions();

            // Create markers and populate locations drop-down menu
            createMarkersAndDropdown(allLocations);

            // Attach event listeners for filters and search
            addSearchAndFilterFunctionality();

            // Now that locations are loaded, attach event listeners to the "More Info" buttons on the homepage
            attachHomepageMoreInfoEvents();
        })
        .catch(error => console.error('Error loading location data:', error));
}

// Function to populate filters
function populateFilters(selector, options) {
    var filters = document.querySelectorAll(selector);
    filters.forEach(filter => {
        // Clear existing options
        filter.innerHTML = '<option value="">All</option>';
        options.forEach(function(optionValue) {
            var option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            filter.appendChild(option);
        });
    });
}

// Function to populate episode filters based on selected area
function updateEpisodeFilterOptions() {
    var areaValue = '';
    document.querySelectorAll('#area-filter, #area-filter-mobile').forEach(areaFilter => {
        if (areaFilter.value) areaValue = areaFilter.value;
    });

    var episodesSet = new Set();

    // Get episodes associated with the selected area
    allLocations.forEach(function(location) {
        var matchesArea = areaValue === "" || location.area === areaValue;
        if (matchesArea && location.episode) {
            location.episode.forEach(ep => episodesSet.add(ep));
        }
    });

    var episodesList = Array.from(episodesSet).sort();

    // Update the episode filters
    populateEpisodeFilters(episodesList);
}

// Function to populate episode filters
function populateEpisodeFilters(episodesList) {
    var episodeFilters = document.querySelectorAll('#episode-filter, #episode-filter-mobile');
    episodeFilters.forEach(filter => {
        // Clear existing options
        filter.innerHTML = '<option value="">All Episodes</option>';
        episodesList.forEach(function(episode) {
            var option = document.createElement('option');
            option.value = episode;
            option.textContent = episode;
            filter.appendChild(option);
        });
    });
}

// Function to attach event listeners to the homepage "More Info" buttons
function attachHomepageMoreInfoEvents() {
    document.querySelectorAll('.more-info-btn').forEach(button => {
        button.addEventListener('click', function() {
            const locationTitle = this.getAttribute('data-location');
            const location = allLocations.find(loc => loc.title === locationTitle);
            if (location) {
                showMoreInfoModal(location);
            }
        });
    });
}

// Function to create markers and populate locations drop-down menu
function createMarkersAndDropdown(locations) {
    var locationsSelect = document.querySelectorAll('#locations-select, #locations-select-mobile');
    locationsSelect.forEach(select => {
        select.innerHTML = '<option value="">-- Select a Location --</option>';
    });

    // Clear existing markers from the map
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    locations.forEach(function(location) {
        // Use title as a unique identifier
        var locationId = location.title;

        // Use markerIcon from location data
        var iconUrl = location.markerIcon || 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';

        // Create marker
        var marker = new google.maps.Marker({
            position: location.position,
            map: map,
            title: location.title,
            icon: iconUrl
        });

        marker.episode = location.episode || [];
        marker.area = location.area || '';
        marker.locationId = locationId;

        // Marker click event
        marker.addListener('click', function() {
            selectLocation(locationId);

            // Update the drop-down menu to reflect the selected location
            locationsSelect.forEach(select => {
                select.value = locationId;
            });
        });

        markers.push(marker);

        // Create option in the drop-down menu
        locationsSelect.forEach(select => {
            var option = document.createElement('option');
            option.value = locationId;
            option.textContent = location.title;
            select.appendChild(option);
        });
    });

    // Event listener for the locations drop-down menu
    locationsSelect.forEach(select => {
        select.addEventListener('change', function() {
            var selectedLocationId = this.value;
            if (selectedLocationId) {
                selectLocation(selectedLocationId);
            } else {
                // If no location is selected, clear the selection
                clearSelection();
            }
        });
    });
}

// Function to select a location
function selectLocation(locationId) {
    // Deselect previous
    if (selectedMarker) {
        selectedMarker.setAnimation(null);
    }

    // Find marker and location
    var marker = markers.find(m => m.locationId === locationId);
    var location = allLocations.find(loc => loc.title === locationId);

    if (marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        selectedMarker = marker;
    }

    // Always center map on the marker
    map.panTo(marker.getPosition());

    // Show location info
    showLocationInfo(location);

    // Update the view based on current mode
    if (isStreetViewVisible) {
        // Update Street View position
        if (location.streetViewCoords) {
            var pov = location.streetViewPov || { heading: 265, pitch: 0 };
            panorama.setPosition(location.streetViewCoords);
            panorama.setPov(pov);
            panorama.setVisible(true);
        } else {
            // Hide Street View if new location doesn't have Street View
            panorama.setVisible(false);
            isStreetViewVisible = false;
            updateStreetViewButtonLabel();
            updateStreetViewButtonLabelMobile();
        }
    }

    // Ensure mobile action bar remains visible
    var mobileActionBar = document.getElementById('mobile-action-bar');
    mobileActionBar.style.display = 'block';

    // Enable buttons
    document.getElementById('more-info-button').disabled = false;
    document.getElementById('street-view-toggle-desktop').disabled = !location.streetViewCoords;
    document.querySelectorAll('#mobile-street-view-toggle').forEach(btn => {
        btn.disabled = !location.streetViewCoords;
    });
}

// Function to clear the selection
function clearSelection() {
    // Deselect previous marker
    if (selectedMarker) {
        selectedMarker.setAnimation(null);
        selectedMarker = null;
    }

    // Reset location info section
    var infoTitle = document.getElementById('location-info-title');
    var infoContent = document.getElementById('location-info-content');
    infoTitle.textContent = 'Select a location';
    infoContent.innerHTML = '<p>Choose a location from the menu above to see more details.</p>';

    // Hide Street View if visible
    if (isStreetViewVisible) {
        panorama.setVisible(false);
        isStreetViewVisible = false;
        updateStreetViewButtonLabel();
        updateStreetViewButtonLabelMobile();
    }

    // Disable buttons
    document.getElementById('more-info-button').disabled = true;
    document.getElementById('street-view-toggle-desktop').disabled = true;
    document.querySelectorAll('#mobile-street-view-toggle').forEach(btn => {
        btn.disabled = true;
    });

    // Hide Mobile Action Bar
    var mobileActionBar = document.getElementById('mobile-action-bar');
    mobileActionBar.style.display = 'none';

    // Close any open InfoWindow
    infoWindow.close();
}

// Function to show location info
function showLocationInfo(location) {
    var infoTitle = document.getElementById('location-info-title');
    var infoContent = document.getElementById('location-info-content');

    infoTitle.textContent = location.title;
    infoContent.innerHTML = location.content || 'Description not available.';

    // Update mobile location title
    var mobileLocationTitle = document.getElementById('mobile-location-title');
    mobileLocationTitle.textContent = location.title;

    // Update buttons
    var streetViewToggleDesktop = document.getElementById('street-view-toggle-desktop');
    var moreInfoButton = document.getElementById('more-info-button');

    streetViewToggleDesktop.disabled = !location.streetViewCoords;
    moreInfoButton.disabled = false;

    // Remove existing event listeners and add new ones
    var newStreetViewButton = streetViewToggleDesktop.cloneNode(true);
    streetViewToggleDesktop.parentNode.replaceChild(newStreetViewButton, streetViewToggleDesktop);
    newStreetViewButton.addEventListener('click', function() {
        toggleStreetView(location.streetViewCoords, location.streetViewPov);
    });

    var newMoreInfoButton = moreInfoButton.cloneNode(true);
    moreInfoButton.parentNode.replaceChild(newMoreInfoButton, moreInfoButton);
    newMoreInfoButton.addEventListener('click', function() {
        showMoreInfoModal(location);
    });

    // Handle Mobile Action Bar
    var mobileActionBar = document.getElementById('mobile-action-bar');
    var mobileStreetViewToggle = document.getElementById('mobile-street-view-toggle');
    var mobileMoreInfoButton = document.getElementById('mobile-more-info-button');

    // Show the action bar
    mobileActionBar.style.display = 'block';

    // Update Street View Button
    if (location.streetViewCoords) {
        mobileStreetViewToggle.style.display = 'block';
        mobileStreetViewToggle.disabled = false;

        // Remove existing event listeners
        var newMobileButton = mobileStreetViewToggle.cloneNode(true);
        mobileStreetViewToggle.parentNode.replaceChild(newMobileButton, mobileStreetViewToggle);

        updateStreetViewButtonLabelMobile();

        newMobileButton.addEventListener('click', function() {
            toggleStreetView(location.streetViewCoords, location.streetViewPov);
        });
    } else {
        mobileStreetViewToggle.style.display = 'block';
        mobileStreetViewToggle.disabled = true;
    }

    // Update More Info Button
    var newMobileMoreInfoButton = mobileMoreInfoButton.cloneNode(true);
    mobileMoreInfoButton.parentNode.replaceChild(newMobileMoreInfoButton, mobileMoreInfoButton);

    newMobileMoreInfoButton.addEventListener('click', function() {
        showMoreInfoModal(location);
    });
}

// Function to show the More Info modal
function showMoreInfoModal(location) {
    var modalTitle = document.getElementById('moreInfoModalLabel');
    var modalSubtitle = document.getElementById('moreInfoModalSubtitle');
    var modalImage = document.getElementById('moreInfoModalImage');
    var modalDescription = document.getElementById('moreInfoModalDescription');

    modalTitle.textContent = location.title;
    modalSubtitle.textContent = location.area;
    modalImage.src = location.imageUrl;
    modalDescription.textContent = location.detailedDescription;

    // Show the modal
    var moreInfoModal = new bootstrap.Modal(document.getElementById('moreInfoModal'));
    moreInfoModal.show();
}

// Function to toggle Street View
function toggleStreetView(coords, pov) {
    var toggle = panorama.getVisible();

    if (toggle === false) {
        // Set the position and make Street View visible
        panorama.setPosition(coords);
        panorama.setPov(pov || { heading: 265, pitch: 0 });
        panorama.setVisible(true);
        isStreetViewVisible = true;
    } else {
        // Hide Street View
        panorama.setVisible(false);
        isStreetViewVisible = false;
    }

    updateStreetViewButtonLabel();
    updateStreetViewButtonLabelMobile();
}

// Function to update the Street View toggle button label
function updateStreetViewButtonLabel() {
    var streetViewToggle = document.getElementById('street-view-toggle-desktop');
    if (isStreetViewVisible) {
        streetViewToggle.textContent = 'Map View';
    } else {
        streetViewToggle.textContent = 'Street View';
    }
}

// Function to update the Street View toggle button label on mobile
function updateStreetViewButtonLabelMobile() {
    var mobileStreetViewToggle = document.getElementById('mobile-street-view-toggle');
    if (isStreetViewVisible) {
        mobileStreetViewToggle.textContent = 'Map View';
    } else {
        mobileStreetViewToggle.textContent = 'Street View';
    }
}

// Function to add search and filter functionality
function addSearchAndFilterFunctionality() {
    var searchBoxes = document.querySelectorAll('#search-box, #search-box-mobile');
    var areaFilters = document.querySelectorAll('#area-filter, #area-filter-mobile');
    var episodeFilters = document.querySelectorAll('#episode-filter, #episode-filter-mobile');

    searchBoxes.forEach(searchBox => searchBox.addEventListener('input', filterMarkersAndDropdown));
    areaFilters.forEach(areaFilter => {
        areaFilter.addEventListener('change', function() {
            updateEpisodeFilterOptions();
            filterMarkersAndDropdown();
        });
    });
    episodeFilters.forEach(episodeFilter => episodeFilter.addEventListener('change', filterMarkersAndDropdown));
}

// Function to filter markers and dropdown based on filters and search
function filterMarkersAndDropdown() {
    var searchTerm = '';
    document.querySelectorAll('#search-box, #search-box-mobile').forEach(searchBox => {
        if (searchBox.value) searchTerm = searchBox.value.toLowerCase();
    });
    var areaValue = '';
    document.querySelectorAll('#area-filter, #area-filter-mobile').forEach(areaFilter => {
        if (areaFilter.value) areaValue = areaFilter.value;
    });
    var episodeValue = '';
    document.querySelectorAll('#episode-filter, #episode-filter-mobile').forEach(episodeFilter => {
        if (episodeFilter.value) {
            episodeValue = episodeFilter.value;
        }
    });

    var filteredLocations = allLocations.filter(function(location) {
        var matchesSearch = location.title.toLowerCase().includes(searchTerm);
        var matchesArea = areaValue === "" || location.area === areaValue;
        var matchesEpisode = episodeValue === "" || (location.episode && location.episode.includes(episodeValue));

        return matchesSearch && matchesArea && matchesEpisode;
    });

    createMarkersAndDropdown(filteredLocations);

    // If a location was previously selected, ensure it remains selected if it's still in the filtered list
    if (selectedMarker && filteredLocations.some(loc => loc.title === selectedMarker.locationId)) {
        document.querySelectorAll('#locations-select, #locations-select-mobile').forEach(select => {
            select.value = selectedMarker.locationId;
        });
    } else {
        clearSelection();
    }
}

// Ensure that showMoreInfoModal is globally accessible
window.showMoreInfoModal = showMoreInfoModal;
