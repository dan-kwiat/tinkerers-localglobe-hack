```
implement the API route handler started in app/api/encode/route.ts
```

```
refactor app/c/[routeId]/page.tsx to call the endpoint defined in app/api/directions/route.ts instead of the encode endpoint. Update the UI copy accordingly.
```

```
Write some typescript code to pass this JSON into a list of steps along the way. For each step, include its name, what type of station it is and what lines it's on (if tube). Let me know first if anything is ambiguous.
```

```
yes, all steps
use an array of station types
use an array for all line info, including bus routes
choose the first route only
yes, filter out empty steps
```

```
In the ./components dir, create a component which renders a svg. The svg  should render a path of TransitStep items as defined in  app/api/directions/parseRoute.ts. First find the geo bounds of the TransitStep array, and define the svg viewBox from that.
```

```
modify the component to accept multiple different `transitSteps` i.e. show      │
│   mulitple paths on the same plot. Adjust the bounding box accordingly.
```

```
Cannot read properties of undefined (reading 'length')

components/TransitRouteVisualization.tsx (92:64) @ <unknown>


  90 |   height = 300
  91 | }: TransitRouteVisualizationProps) {
> 92 |   if (routes.length === 0 || routes.every(route => route.steps.length === 0)) {
     |                                                                ^
  93 |     return (
  94 |       <div className="flex items-center justify-center p-8 text-gray-500">
  95 |         No transit routes to display

```

```
Good but the calculation of the bounding box seems to be off, can you fix       │
│   that?
`
```

```
 Edit the component in app/c/[routeId]/page.tsx to only return the card if the   │
│   directions are undefined. If they are defined, show the svg in an appropriate   │
│   container with a button below titled "Find a cafe"
```

````
update the app/api/encode/route.ts file to use the places api instead of the    │
│   geocoding api. example call: ```curl -X POST -d '{                              │
│     "textQuery" : "Spicy Vegetarian Food in Sydney, Australia"                    │
│   }' \                                                                            │
│   -H 'Content-Type: application/json' -H 'X-Goog-Api-Key: API_KEY' \              │
│   -H 'X-Goog-FieldMask:                                                           │
│   places.displayName,places.formattedAddress,places.priceLevel' \                 │
│   'https://places.googleapis.com/v1/places:searchText'```
````

```
extract the place -> coordinates lookup functionality to a file in ./lib. Put   │
│   the key loading from env vars in there too.
```

```
move the getDirections method in app/api/directions/route.ts to the new lib     │
│   file
```

```
 Now in the directions route.ts, geocode the B commute before finding            │
│   directions. Use the appropriate method in the lib.
```
