/* ================================================================
   script.js
   WebGIS Kec. Mapanget — Eka Putra Natanael (241011060052)
   Berisi: Leaflet map, custom DivIcon marker, semua layer GeoJSON,
           dan cuaca real-time dari Open-Meteo API.
   ================================================================ */


/* ----------------------------------------------------------------
   1. INISIALISASI PETA
---------------------------------------------------------------- */
var map = L.map('map', {
    zoomControl: false,
    maxZoom: 28,
    minZoom: 1
}).fitBounds([
    [1.4778569547568072, 124.84964440688074],
    [1.5264888290140612, 124.92804488295607]
]);

var hash = new L.Hash(map);

map.attributionControl.setPrefix(
    '<a href="https://github.com/tomchadwin/qgis2web" target="_blank">qgis2web</a>' +
    ' &middot; <a href="https://leafletjs.com">Leaflet</a>' +
    ' &middot; <a href="https://qgis.org">QGIS</a>'
);

var autolinker = new Autolinker({ truncate: { length: 30, location: 'smart' } });


/* ----------------------------------------------------------------
   2. ZOOM CONTROL (kiri atas)
---------------------------------------------------------------- */
L.control.zoom({ position: 'topleft' }).addTo(map);

var bounds_group = new L.featureGroup([]);
function setBounds() {}


/* ----------------------------------------------------------------
   3. HELPER: CUSTOM DIVICON MARKER
      size      : diameter dalam px (default 32)
      emoji     : karakter emoji
      bgColor   : warna background lingkaran
      borderColor: warna border (opsional)
---------------------------------------------------------------- */
function makeIcon(emoji, bgColor, size, borderColor) {
    size        = size        || 34;
    borderColor = borderColor || 'rgba(255,255,255,0.75)';
    var half    = size / 2;
    var fontSize = Math.round(size * 0.5);

    return L.divIcon({
        className: '',
        html: '<div class="custom-marker" style="' +
                'width:'            + size      + 'px;' +
                'height:'           + size      + 'px;' +
                'background:'       + bgColor   + ';' +
                'border:2.5px solid ' + borderColor + ';' +
                'border-radius:50%;' +
                'display:flex;align-items:center;justify-content:center;' +
                'font-size:'        + fontSize  + 'px;' +
                'box-shadow:0 3px 10px rgba(0,0,0,0.5);' +
                'position:relative;' +
              '">' + emoji + '</div>',
        iconSize:   [size, size + 8],
        iconAnchor: [half, size + 8],
        popupAnchor:[0, -(size + 8)]
    });
}

/* Ikon per kategori */
var icons = {
    ibadah     : makeIcon('🕌', '#fbbf24', 34),
    rumah      : makeIcon('🏠', '#3b82f6', 34, '#93c5fd'),
    restaurant : makeIcon('🍽️', '#ef4444', 34),
    cafe       : makeIcon('☕', '#7c3aed', 34),
    minimarket : makeIcon('🛒', '#10b981', 34),
    sekolah    : makeIcon('🏫', '#0ea5e9', 34),
};


/* ----------------------------------------------------------------
   4. FUNGSI UTILITAS POPUP
---------------------------------------------------------------- */
function removeEmptyRowsFromPopupContent(content, feature) {
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    var rows = tempDiv.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
        var td  = rows[i].querySelector('td.visible-with-data');
        var key = td ? td.id : '';
        if (td && td.classList.contains('visible-with-data') && feature.properties[key] == null) {
            rows[i].parentNode.removeChild(rows[i]);
        }
    }
    return tempDiv.innerHTML;
}

function addClassToPopupIfMedia(content, popup) {
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    var imgTd = tempDiv.querySelector('td img');
    if (!imgTd) { popup._contentNode.classList.remove('media'); return; }
    var src = imgTd.getAttribute('src');
    if (/\.(jpg|jpeg|png|gif|bmp|webp|avif)$/i.test(src)) {
        popup._contentNode.classList.add('media');
        setTimeout(function () { popup.update(); }, 10);
    } else if (/\.(mp3|wav|ogg|aac)$/i.test(src)) {
        var audio = document.createElement('audio');
        audio.controls = true; audio.src = src;
        imgTd.parentNode.replaceChild(audio, imgTd);
        popup._contentNode.classList.add('media');
        setTimeout(function () { popup.setContent(tempDiv.innerHTML); popup.update(); }, 10);
    } else if (/\.(mp4|webm|ogg|mov)$/i.test(src)) {
        var video = document.createElement('video');
        video.controls = true; video.src = src;
        video.style.cssText = 'width:400px;height:300px;max-width:60vw;max-height:60vh;';
        imgTd.parentNode.replaceChild(video, imgTd);
        popup._contentNode.classList.add('media');
        video.addEventListener('loadedmetadata', function () { popup.update(); });
        setTimeout(function () { popup.setContent(tempDiv.innerHTML); popup.update(); }, 10);
    } else {
        popup._contentNode.classList.remove('media');
    }
}

/** Helper buat baris popup */
function pRow(label, val) {
    if (val === null || val === undefined || val === '') return '';
    return '<tr><td><strong>' + label + '</strong></td><td>' +
           autolinker.link(String(val).replace(/'/g, "'")) + '</td></tr>';
}


/* ----------------------------------------------------------------
   5. BASE LAYERS — Google Road & Hybrid
---------------------------------------------------------------- */
map.createPane('pane_GoogleRoad_0');
map.getPane('pane_GoogleRoad_0').style.zIndex = 400;
var layer_GoogleRoad_0 = L.tileLayer(
    'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        pane: 'pane_GoogleRoad_0', opacity: 1,
        attribution: 'Map data ©2015 Google',
        minZoom: 1, maxZoom: 28, minNativeZoom: 0, maxNativeZoom: 20
    });
map.addLayer(layer_GoogleRoad_0);

map.createPane('pane_GoogleHybrid_1');
map.getPane('pane_GoogleHybrid_1').style.zIndex = 401;
var layer_GoogleHybrid_1 = L.tileLayer(
    'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        pane: 'pane_GoogleHybrid_1', opacity: 1,
        attribution: 'Map data ©2015 Google',
        minZoom: 1, maxZoom: 28, minNativeZoom: 0, maxNativeZoom: 20
    });
map.addLayer(layer_GoogleHybrid_1);


/* ----------------------------------------------------------------
   6. LAYER — Batas Wilayah Kelurahan/Desa (polygon)
---------------------------------------------------------------- */
function pop_Batas_Wilayah_KelurahanDesa_10K_AR_2(feature, layer) {
    var p = feature.properties;
    var popupContent = '<table>' +
        pRow('Nama Objek', p['NAMOBJ']) +
        pRow('Kecamatan',  p['WADMKC']) +
        pRow('Kelurahan',  p['WADMKD']) +
        pRow('Kabupaten',  p['WADMKK']) +
        pRow('Provinsi',   p['WADMPR']) +
        pRow('Luas (ha)',  p['LUAS'])   +
        pRow('Tipe Adm',   p['TIPADM']) +
        '</table>';
    var content = removeEmptyRowsFromPopupContent(popupContent, feature);
    layer.on('popupopen', function (e) { addClassToPopupIfMedia(content, e.popup); });
    layer.bindPopup(content, { maxHeight: 400 });
}

function style_Batas_Wilayah_KelurahanDesa_10K_AR_2_0() {
    return {
        pane: 'pane_Batas_Wilayah_KelurahanDesa_10K_AR_2',
        opacity: 1,
        color: 'rgba(0,0,0,1.0)',
        dashArray: '', lineCap: 'square', lineJoin: 'bevel',
        weight: 4.0, fillOpacity: 0, interactive: true,
    };
}
map.createPane('pane_Batas_Wilayah_KelurahanDesa_10K_AR_2');
map.getPane('pane_Batas_Wilayah_KelurahanDesa_10K_AR_2').style.zIndex = 402;
map.getPane('pane_Batas_Wilayah_KelurahanDesa_10K_AR_2').style['mix-blend-mode'] = 'normal';
var layer_Batas = new L.geoJson(json_Batas_Wilayah_KelurahanDesa_10K_AR_2, {
    attribution: '', interactive: true,
    pane: 'pane_Batas_Wilayah_KelurahanDesa_10K_AR_2',
    onEachFeature: pop_Batas_Wilayah_KelurahanDesa_10K_AR_2,
    style: style_Batas_Wilayah_KelurahanDesa_10K_AR_2_0,
});
bounds_group.addLayer(layer_Batas);
map.addLayer(layer_Batas);


/* ----------------------------------------------------------------
   7. LAYER — Titik Ibadah  (ikon: 🕌 kuning)
---------------------------------------------------------------- */
function pop_ibadah(feature, layer) {
    var p = feature.properties;
    var popupContent = '<table>' +
        pRow('Nama',        p['name'])        +
        pRow('Jenis',       p['amenity'])     +
        pRow('Agama',       p['religion'])    +
        pRow('Denominasi',  p['denomination'])+
        pRow('Alamat',      p['addr:full'])   +
        pRow('Kota',        p['addr:city'])   +
        pRow('Wikipedia',   p['wikipedia'])   +
        '</table>';
    var content = removeEmptyRowsFromPopupContent(popupContent, feature);
    layer.on('popupopen', function (e) { addClassToPopupIfMedia(content, e.popup); });
    layer.bindPopup(content, { maxHeight: 400 });
}
map.createPane('pane_titikibadahmanadofixbulatcentroids_3');
map.getPane('pane_titikibadahmanadofixbulatcentroids_3').style.zIndex = 403;
map.getPane('pane_titikibadahmanadofixbulatcentroids_3').style['mix-blend-mode'] = 'normal';
var layer_ibadah = new L.geoJson(json_titikibadahmanadofixbulatcentroids_3, {
    attribution: '', interactive: true,
    pane: 'pane_titikibadahmanadofixbulatcentroids_3',
    onEachFeature: pop_ibadah,
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: icons.ibadah, pane: 'pane_titikibadahmanadofixbulatcentroids_3' });
    },
});
bounds_group.addLayer(layer_ibadah);
map.addLayer(layer_ibadah);


/* ----------------------------------------------------------------
   8. LAYER — Rumah Eka Putra  (ikon: 🏠 biru)
---------------------------------------------------------------- */
function pop_rumah(feature, layer) {
    var p = feature.properties;
    var popupContent = '<table>' +
        pRow('ID',    p['id'])         +
        pRow('Nama',  p['eka putra'])  +
        '</table>';
    var content = removeEmptyRowsFromPopupContent(popupContent, feature);
    layer.on('popupopen', function (e) { addClassToPopupIfMedia(content, e.popup); });
    layer.bindPopup(content, { maxHeight: 400 });
}
map.createPane('pane_rumahekaputra_4');
map.getPane('pane_rumahekaputra_4').style.zIndex = 404;
map.getPane('pane_rumahekaputra_4').style['mix-blend-mode'] = 'normal';
var layer_rumah = new L.geoJson(json_rumahekaputra_4, {
    attribution: '', interactive: true,
    pane: 'pane_rumahekaputra_4',
    onEachFeature: pop_rumah,
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: icons.rumah, pane: 'pane_rumahekaputra_4' });
    },
});
bounds_group.addLayer(layer_rumah);
map.addLayer(layer_rumah);


/* ----------------------------------------------------------------
   9. LAYER — Restoran  (ikon: 🍽️ merah)
---------------------------------------------------------------- */
function pop_restaurant(feature, layer) {
    var p = feature.properties;
    var popupContent = '<table>' +
        pRow('Nama',    p['name'])     +
        pRow('Jenis',   p['amenity'])  +
        pRow('OSM ID',  p['osm_id'])   +
        '</table>';
    var content = removeEmptyRowsFromPopupContent(popupContent, feature);
    layer.on('popupopen', function (e) { addClassToPopupIfMedia(content, e.popup); });
    layer.bindPopup(content, { maxHeight: 400 });
}
map.createPane('pane_restaurantcentroids_5');
map.getPane('pane_restaurantcentroids_5').style.zIndex = 405;
map.getPane('pane_restaurantcentroids_5').style['mix-blend-mode'] = 'normal';
var layer_restaurant = new L.geoJson(json_restaurantcentroids_5, {
    attribution: '', interactive: true,
    pane: 'pane_restaurantcentroids_5',
    onEachFeature: pop_restaurant,
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: icons.restaurant, pane: 'pane_restaurantcentroids_5' });
    },
});
bounds_group.addLayer(layer_restaurant);
map.addLayer(layer_restaurant);


/* ----------------------------------------------------------------
   10. LAYER — Café  (ikon: ☕ ungu)
---------------------------------------------------------------- */
function pop_cafe(feature, layer) {
    var p = feature.properties;
    var popupContent = '<table>' +
        pRow('Nama',    p['name'])     +
        pRow('Jenis',   p['amenity'])  +
        pRow('Gedung',  p['building']) +
        '</table>';
    var content = removeEmptyRowsFromPopupContent(popupContent, feature);
    layer.on('popupopen', function (e) { addClassToPopupIfMedia(content, e.popup); });
    layer.bindPopup(content, { maxHeight: 400 });
}
map.createPane('pane_cafe__centroids_6');
map.getPane('pane_cafe__centroids_6').style.zIndex = 406;
map.getPane('pane_cafe__centroids_6').style['mix-blend-mode'] = 'normal';
var layer_cafe = new L.geoJson(json_cafe__centroids_6, {
    attribution: '', interactive: true,
    pane: 'pane_cafe__centroids_6',
    onEachFeature: pop_cafe,
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: icons.cafe, pane: 'pane_cafe__centroids_6' });
    },
});
bounds_group.addLayer(layer_cafe);
map.addLayer(layer_cafe);


/* ----------------------------------------------------------------
   11. LAYER — Minimarket  (ikon: 🛒 hijau)
---------------------------------------------------------------- */
function pop_minimarket(feature, layer) {
    var p = feature.properties;
    var popupContent = '<table>' +
        pRow('ID',          p['id'])          +
        pRow('Minimarket',  p['Minimarket'])   +
        '</table>';
    var content = removeEmptyRowsFromPopupContent(popupContent, feature);
    layer.on('popupopen', function (e) { addClassToPopupIfMedia(content, e.popup); });
    layer.bindPopup(content, { maxHeight: 400 });
}
map.createPane('pane_Minimarket_7');
map.getPane('pane_Minimarket_7').style.zIndex = 407;
map.getPane('pane_Minimarket_7').style['mix-blend-mode'] = 'normal';
var layer_minimarket = new L.geoJson(json_Minimarket_7, {
    attribution: '', interactive: true,
    pane: 'pane_Minimarket_7',
    onEachFeature: pop_minimarket,
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: icons.minimarket, pane: 'pane_Minimarket_7' });
    },
});
bounds_group.addLayer(layer_minimarket);
map.addLayer(layer_minimarket);


/* ----------------------------------------------------------------
   12. LAYER — Sekolah  (ikon: 🏫 biru muda)
---------------------------------------------------------------- */
function pop_sekolah(feature, layer) {
    var p = feature.properties;
    var popupContent = '<table>' +
        pRow('ID',      p['id'])       +
        pRow('Sekolah', p['Sekolah'])  +
        '</table>';
    var content = removeEmptyRowsFromPopupContent(popupContent, feature);
    layer.on('popupopen', function (e) { addClassToPopupIfMedia(content, e.popup); });
    layer.bindPopup(content, { maxHeight: 400 });
}
map.createPane('pane_Sekolah_8');
map.getPane('pane_Sekolah_8').style.zIndex = 408;
map.getPane('pane_Sekolah_8').style['mix-blend-mode'] = 'normal';
var layer_sekolah = new L.geoJson(json_Sekolah_8, {
    attribution: '', interactive: true,
    pane: 'pane_Sekolah_8',
    onEachFeature: pop_sekolah,
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: icons.sekolah, pane: 'pane_Sekolah_8' });
    },
});
bounds_group.addLayer(layer_sekolah);
map.addLayer(layer_sekolah);

setBounds();


/* ----------------------------------------------------------------
   13. CUACA REAL-TIME — Open-Meteo API
       Koordinat Manado: lat 1.4931 | lon 124.8413
       Diperbarui otomatis setiap 10 menit
---------------------------------------------------------------- */

/** Konversi WMO weathercode → emoji + teks Indonesia */
function wmoToDesc(code) {
    var map2 = {
        0:  ['☀️',  'Cerah'],
        1:  ['🌤',  'Cerah Sebagian'],
        2:  ['⛅',  'Berawan'],
        3:  ['☁️',  'Mendung'],
        45: ['🌫',  'Kabut'],
        48: ['🌫',  'Kabut Beku'],
        51: ['🌦',  'Gerimis Ringan'],
        53: ['🌦',  'Gerimis'],
        55: ['🌧',  'Gerimis Lebat'],
        61: ['🌧',  'Hujan Ringan'],
        63: ['🌧',  'Hujan Sedang'],
        65: ['🌧',  'Hujan Lebat'],
        80: ['🌦',  'Hujan Lokal'],
        81: ['🌧',  'Hujan Deras'],
        95: ['⛈',  'Badai Petir'],
        99: ['⛈',  'Badai + Hujan Es'],
    };
    return map2[code] || ['🌡', 'Tidak Diketahui'];
}

function fetchWeather() {
    var box  = document.getElementById('weather-box');
    var url  = 'https://api.open-meteo.com/v1/forecast' +
               '?latitude=1.4931&longitude=124.8413&current_weather=true';

    fetch(url)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
            var cw    = data.current_weather;
            var d     = wmoToDesc(cw.weathercode);
            var emoji = d[0], kondisi = d[1];
            var now   = new Date();
            var pad   = function (n) { return n < 10 ? '0' + n : n; };
            var time  = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' WITA';

            box.innerHTML =
                '<div class="w-item">' +
                    '<div class="w-emoji">' + emoji + '</div>' +
                    '<div class="w-condition-text">' + kondisi + '</div>' +
                '</div>' +
                '<div class="w-divider"></div>' +
                '<div class="w-item">' +
                    '<div class="w-val">' + cw.temperature + '°C</div>' +
                    '<div class="w-lbl">Suhu</div>' +
                '</div>' +
                '<div class="w-divider"></div>' +
                '<div class="w-item">' +
                    '<div class="w-val">' + cw.windspeed + '</div>' +
                    '<div class="w-lbl">km/h Angin</div>' +
                '</div>' +
                '<span id="weather-update" style="' +
                    'position:absolute;bottom:4px;right:10px;' +
                    'font-size:8px;color:rgba(255,255,255,0.25);' +
                '">' + time + '</span>';

            box.style.position = 'relative';
        })
        .catch(function () {
            box.innerHTML = '<span id="weather-loading">⚠ Cuaca tidak tersedia</span>';
        });
}

/* Jalankan saat load, refresh tiap 10 menit */
fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000);