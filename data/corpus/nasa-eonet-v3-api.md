---
title: NASA EONET v3 API documentation (Earth only)
url: https://eonet.gsfc.nasa.gov/docs/v3
source: curated
retrievedDate: 2026-10-04
---

# Version 3 Documentation

Version 3 is the latest version of the API. Version 2.1 is deprecated and tagged for removal but is still currently available.

To see what’s changed, please view the changelog . There are also a few how-tos . Below are descriptions of the data model fields and the API itself. Please note that all metadata contained within EONET is subject to our disclaimer.

## Fields

### Events

The Event object is returned within the Events API.

| Unique id for this event.

| The title of the event.

| Optional longer description of the event. Most likely only a sentence or two.

| The full link to the API endpoint for this specific event.

| An event is deemed “closed” when it has ended. The closed field will include a date/time when the event has ended. Depending upon the nature of the event, the closed value may or may not accurately represent the absolute ending of the event. If the event is open, this will show “null”.

| One or more categories assigned to the event.

| One or more sources that refer to more information about the event.

| One or more event geometries are the pairing of a specific date/time with a location. The date/time will most likely be 00:00Z unless the source provided a particular time. The geometry will be a GeoJSON object of either type “Point” or “Polygon.”

| Information regarding the event magnitude, if available, is displayed here.

### Events (GeoJSON)

| The type of data object.

| Properties for the data object outside the GeoJSON standard. This can include “id,” “title,” “description,” “link,” open/closed status, “date,” “magnitudeValue,” “magnitudeUnit,” “magnitudeDescription,” “categories,” and “sources.”

| In the event that the Feature is a line string, this will be an array of the dates that correspond with the array of coordinates in the geometry field.

### Categories

Categories are the types of events by which individual events are cataloged. Categories can be used to filter the output of the Categories API and the Layers API . The acceptable categories can be accessed via the categories JSON.

| Unique id for this category (integer).

| The title of the category.

| Longer description of the category, addressing the scope. Most likely only a sentence or two.

| The full link to the API endpoint for this specific category, which is the same as the Categories API endpoint filtered to return only events from this category.

| A service endpoint that points to the Layers API endpoint filtered to return only layers from this category.

### Sources

A Source is a reference to further information about the event. These references are usually the source from which the event was first curated, although there can be multiple sources per event. Source(s) can be used to filter the output of the Events API. The acceptable sources can be accessed via the sources JSON.

| Unique id for this type.

| The title of this source.

| The homepage URL for the source.

| The full link to the API endpoint for this specific source, which is the same as the Events API endpoint only filtered to return only events from this source.

### Layers

A Layer is a reference to a specific web service (e.g., WMS, WMTS) that can be used to produce imagery of a particular NASA data parameter. Layers are mapped to categories within EONET to provide a category-specific list of layers (e.g., the ‘Volcanoes’ category is mapped to layers that can provide imagery in true color, SO2, aerosols, etc.). Web services come in a variety of flavors, so it is not possible to include all of the necessary metadata here that is required to construct a properly-formulated request (URL). The full list of layers can be accessed via the layers JSON.

| The name of the layer as specified by the source web service found at serviceUrl .

| The base URL of the web service.

| A string to indicate the type (WMS, WMTS, etc.) and version (1.0.0, 1.3.0, etc.) of the web

service found at serviceUrl .

| Zero or more URL parameters that are pertinent to the construction of a properly-formatted request to the web service found at serviceUrl .

## API

| Filter the returned events by the Source. Multiple sources can be included in the parameter: comma separated, operates as a boolean OR.

| Filter the returned events by the category. Multiple sources can be included in the parameter: comma separated, operates as a boolean OR.

| open | closed | all

| Events that have ended are assigned a closed date and the existence of that date will

allow you to filter for only-open or only-closed events. Omitting the status parameter will

return only the currently open events (default). Using “all“ will list open and

| Limits the number of events returned

| Limit the number of prior days (including today) from which events will be returned.

| Select a range of dates for the events to fall between (inclusive) in a YYYY-MM-DD format.

#.##

| Select a ceiling, floor, or range of magnitude values for the events to fall between (inclusive).

| min lon, max lat,

max lon, min lat

| Query using a bounding box for all events with datapoints that fall within. This uses two pairs of coordinates:

the upper left hand corner (lon,lat) followed by the lower right hand corner (lon,lat).

Return the most recent 5 events within the past 20 days that have an InciWeb source and are open (still active events).

| Events that have ended are assigned a closed date and the existence of that date will allow you to filter for only-open or only-closed events. Omitting the status parameter will return only the currently open events (default). Using “all“ will list open and closed values.

| Query using a bounding box for all events with datapoints that fall within. This uses two pairs of coordinates: the upper left hand corner (lon,lat) followed by the lower right hand corner (lon,lat).

| Filter the events by the Category .

| Filter the topically-constrained events by the Source. Multiple sources can be included in the parameter: comma separated, operates as a boolean OR.

| open | closed

| Events that have ended are assigned a closed date and the existence of that date will allow you to filter for only-open or only-closed events. Omitting the status parameter will return only the currently open events.

| Filter the layers by the Category .
