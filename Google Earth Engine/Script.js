// Funktion zur Maskierung von Wolken in Sentinel-2-Bildern
function maskS2clouds(image) {
    var qa = image.select('QA60');
    
    // Bits 10 und 11 sind Wolken und Cirrus.
    var cloudBitMask = 1 << 10;
    var cirrusBitMask = 1 << 11;
    
    // Beide Flags auf 0 setzen, um klare Bedingungen anzuzeigen.
    var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
        .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
    
    return image.updateMask(mask).divide(10000)
                        .clip(table);
  }
  
  // Visualisierungsparameter für RGB
  var visualization = {
    min: 0.0,
    max: 0.3,
    bands: ['B4', 'B3', 'B2'],
  };
  
  // Visualisierungsparameter für NDWI Gao
  var ndwiVisualization = {
    min: -1.0,
    max: 1.0,
    palette: ['red', 'yellow', 'green']  // Blau für Wasser, Grün/Weiß für Land
  };
  
  // Visualisierungsparameter für NDVI
  var ndviVisualization = {
    min: -1.0,
    max: 1.0,
    palette: ['red', 'yellow', 'green']  // Blau für Wasser, Grün/Weiß für Land
  };
  
  // NDWI Gao Berechnung: (NIR - SWIR) / (NIR + SWIR)
  function calculateNDWI(image) {
    return image.normalizedDifference(['B8', 'B11']).rename('NDWI2');
  }
  
  // NDVI Berechnung: (NIR - R) / (NIR + R)
  function calculateNDVI(image) {
    return image.normalizedDifference(['B8', 'B4']).rename('NDWI2');
  }
  
  // Funktion zum Laden der Bilder, Filtern nach Monat und Berechnung des NDWI/NDVI
  function getMonthlyImage(year, month, aoi) {
    var startDate = ee.Date.fromYMD(year, month, 1);
    var endDate = startDate.advance(1, 'month');
  
    // Filtere die Sentinel-2-Bilder basierend auf dem Zeitraum und der AOI
    var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                      .filterDate(startDate, endDate)
                      .filterBounds(aoi)
                      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))  // Wolken unter 20%
                      .map(maskS2clouds);
    
    // Anzahl der verfügbaren Bilder in der Kollektion ausgeben
    var count = collection.size();
    print('Anzahl der Bilder im Monat ' + ee.Date.fromYMD(year, month, 1).format('MMM yyyy').getInfo() + ':', count);
    
    // Wähle das Bild mit der geringsten Wolkenbedeckung
    return collection.sort('CLOUDY_PIXEL_PERCENTAGE').first();  // Sortiere nach Wolkenbedeckung und nimm das erste Bild
    
  }
  
  // AOI definieren
  var aoi = geometry;
  
  // Monate für den Zeitraum April bis Oktober
  var months = ee.List.sequence(4, 10);  // Monate 4 (April) bis 10 (Oktober)
  //Jahre, für die Daten geladen werden sollen
  var years = [2023];  // 2023
  
  // Schleife über die Monate
  years.forEach(function(year)  {
    months.getInfo().forEach(function(month) {
      var bestImage = getMonthlyImage(year, month, aoi);
    
      if (bestImage) {
        // NDWI/NDVI berechnen
        var ndwi = calculateNDWI(bestImage);
        var ndvi = calculateNDVI(bestImage);
        
        // Monatsname in dreibuchstabiger Form (z.B. 'Apr', 'Mai')
        var monthAbbreviation = ee.Date.fromYMD(year, month, 1).format('MMM').getInfo();
      /*
      // Exportiere das NDWI für den Monat
      Export.image.toDrive({
        image: ndwi,
        description: 'NDWI_' + monthAbbreviation + '_' + year,  // Beispiel: NDWI_Apr_2023
        folder: 'GEE_Exports',
        scale: 10,
        region: aoi,
        fileFormat: 'GEOTIFF',
        maxPixels: 1e8
      });
      */
        // RGB-Visualisierung als Layer hinzufügen
        Map.addLayer(bestImage, visualization, 'RGB ' + ee.Date.fromYMD(year, month, 1).format('MMM yyyy').getInfo());
      
        // NDWI als Layer hinzufügen
        Map.addLayer(ndwi, ndwiVisualization, 'NDWI ' + ee.Date.fromYMD(year, month, 1).format('MMM yyyy').getInfo());
  
        // NDVI als Layer hinzufügen
        Map.addLayer(ndvi, ndviVisualization, 'NDVI ' + ee.Date.fromYMD(year, month, 1).format('MMM yyyy').getInfo());

      }
    });
  });
  
  // Funktion zum Erstellen eines Farbbalkens
  function makeColorBar(palette) {
    return ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: {
        bbox: [0, 0, 1, 0.1],
        dimensions: '100x10',
        format: 'png',
        min: 0,
        max: 1,
        palette: palette
      },
      style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'}
    });
  }
  
  // Funktion zum Erstellen einer Legende
  function makeLegend(title, palette, min, max) {
    var legend = ui.Panel({
      style: {
        position: 'bottom-right',
        padding: '8px',
        backgroundColor: 'white'
      }
    });
  
    legend.add(ui.Label({
      value: title,
      style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0'}
    }));
  
    legend.add(makeColorBar(palette));
  
    var minLabel = ui.Label(min.toString(), {margin: '4px 8px'});
    var maxLabel = ui.Label(max.toString(), {margin: '4px 8px', textAlign: 'right', stretch: 'horizontal'});
    legend.add(ui.Panel([minLabel, maxLabel], ui.Panel.Layout.flow('horizontal')));
  
    return legend;
  }
  
  // Kontrollkästchen für NDWI
  var ndwiCheckbox = ui.Checkbox({
    label: 'NDWI anzeigen',
    value: false, // Standardmäßig nicht ausgewählt
    onChange: function(checked) {
      if (checked) {
        Map.add(ndwiLegend);
      } else {
        Map.remove(ndwiLegend);
      }
    }
  });
  
  // Kontrollkästchen für NDVI
  var ndviCheckbox = ui.Checkbox({
    label: 'NDVI anzeigen',
    value: false, // Standardmäßig nicht ausgewählt
    onChange: function(checked) {
      if (checked) {
        Map.add(ndviLegend);
      } else {
        Map.remove(ndviLegend);
      }
    }
  });
  
  // Panel für Kontrollkästchen
  var legendPanel = ui.Panel({
    widgets: [ndwiCheckbox, ndviCheckbox],
    style: {
      position: 'top-right',
      padding: '8px',
      backgroundColor: 'white'
    }
  });
  
  // Panel zur Karte hinzufügen
  Map.add(legendPanel);
  
  // Legenden definieren
  var ndwiLegend = makeLegend('NDWI', ndwiVisualization.palette, ndwiVisualization.min, ndwiVisualization.max);
  var ndviLegend = makeLegend('NDVI', ndviVisualization.palette, ndviVisualization.min, ndviVisualization.max);
  
  // Variable, um das aktuelle Popup zu speichern
  var currentPopup = null;
  
  // Funktion zum Erstellen eines Popups bei Klick auf die Karte
  Map.onClick(function(coords) {
    // Falls ein Popup vorhanden ist, entfernen
    if (currentPopup) {
      Map.remove(currentPopup);
    }
  
    // Längen- und Breitengrad der Klickposition
    var point = ee.Geometry.Point([coords.lon, coords.lat]);
  
    // Sicherstellen, dass das Bild für den aktuellen Monat vorhanden ist
    var image = getMonthlyImage(2023, 4, aoi);  // Beispiel für 2023 und April
  
    if (image) {
      // NDWI-Werte an dieser Position abrufen
      var ndwiValue = image.normalizedDifference(['B8', 'B11']).rename('NDWI').reduceRegion({
        reducer: ee.Reducer.mean(),  // Reduziert den Wert zu einem einzelnen Pixelwert
        geometry: point,
        scale: 10  // Sentinel-2 hat eine 10m Auflösung für die RGB-Bänder
      });
      // NDVI-Werte an dieser Position abrufen
      var ndviValue = image.normalizedDifference(['B8', 'B4']).rename('NDVI').reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: point,
        scale: 10
      });
  
      // Werte in der Konsole ausgeben
      ndwiValue.evaluate(function(val) {
        print('NDWI Wert:', val);
      });
  
      ndviValue.evaluate(function(val) {
        print('NDVI Wert:', val);
      });
  
      // Popup-Inhalt erstellen, nachdem die Werte evaluiert wurden
      ndwiValue.evaluate(function(ndwiVal) {
        ndviValue.evaluate(function(ndviVal) {
          var ndwiText = 'NDWI-Wert: ' + (ndwiVal.NDWI ? ndwiVal.NDWI.toFixed(4) : 'Keine Daten');
          var ndviText = 'NDVI-Wert: ' + (ndviVal.NDVI ? ndviVal.NDVI.toFixed(4) : 'Keine Daten');
          
          // Popup-Panel erstellen
          currentPopup = ui.Panel({
            widgets: [
              ui.Label(ndwiText),
              ui.Label(ndviText)
            ],
            style: {position: 'top-center'} // Position des Popups
          });
  
          // Popup zur Karte hinzufügen
          Map.add(currentPopup);
        });
      });
    } else {
      print('Kein Bild vorhanden.');
    }
  });
  
  Map.centerObject(aoi, 12);
