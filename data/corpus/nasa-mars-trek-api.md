---
title: NASA Mars Trek API (WMTS tile service)
url: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
source: curated
retrievedDate: 2026-10-04
---

- TREK MAP SERVICES

- SOLAR SYSTEM TREKS

#

# WMTS Layer Services

Map layers are available through the OGC RESTful WMTS protocol. To find out more information about OGC WMTS, go to https://www.opengeospatial.org/standards/wmts . A simple javascript example using ESRI javascript client library is included for each service. Click 'Preview' to run it.

To access these tiles through a WMTS client library, depending on the WMTS client library, you only need to provide the WMTS Endpoint and the full extent or bbox information. However, if you want to access tiles without using a WMTS client library, the following information will give you some help.

Here is basic information about how to request image tiles from a RESTful WMTS service. The basic URL template is as follows:

* Some services are .png and some are .jpg. Please look at WMTS GetCapabilities ResourcesURL element to find out what extension to use.

In order to fill in the variables in the template URL, you need to parse the WMTS GetCapabilities XML. GetCapabilities XML can be found for each product below.

From the WMTS GetCapabilities XML, find ows:Identifier element inside Style element. This value replaces {Style}. The ows:Identifier element inside TileMatrixSet element replaces {TileMatrixSet}. Inside the TileMatrixSet element in WMTS Capabilities, there is a list of TileMatrix. This is the Zoom level. Replace {TileMatrix} with the ows:Identifier found in TileMatrix element.

{TileRow} and {TileCol} are row and col index for tiles. The first zoom level for a product that covers the entire globe will have two columns and one row so that the URLs are as follows:

The second zoom level has four columns and two rows and so on.

If the image tile is missing, that means there is no data coverage in that area. You can also use coverage Bbox to calculate the coverage before requesting image tiles.

## Equirectangular

## North Pole

## South Pole
