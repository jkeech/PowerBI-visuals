/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved. 
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *   
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *   
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/* Please make sure that this path is correct */
/// <reference path="../_references.ts"/>

module powerbi.visuals {
    import Debug = debug;
    import ClassAndSelector = jsCommon.CssConstants.ClassAndSelector;

    export interface Percentile {
        percentile: number;
        value: number;
    }

    export interface Legend {
        text: string;
        transform?: string;
        dx?: string;
        dy?: string;
    }

    export interface PercentileChartViewModel {
        percentiles: Percentile[];
        settings: PercentileChartSettings;
        xAxis: IAxisProperties;
        yAxis: IAxisProperties;
        legends: Legend[];
    };

    export interface PercentileChartSettings {
        fillColor: string;
        precision: number;
        xAxisTitle: string;
    };

    export class PercentileChart implements IVisual {
        /**
        * Informs the System what it can do
        * Fields, Formatting options, data reduction & QnA hints
        */
        public static capabilities: VisualCapabilities = {
            dataRoles: [{
                name: "Category",
                kind: VisualDataRoleKind.Grouping,
                displayName: data.createDisplayNameGetter("Role_DisplayName_Category")
            }, {
                name: "Values",
                kind: VisualDataRoleKind.Measure,
                displayName: data.createDisplayNameGetter("Role_DisplayName_Values")
            }],
            dataViewMappings: [{
                conditions: [{
                    "Category": {
                        min: 1,
                        max: 1
                    },
                    "Values": {
                        min: 0,
                        max: 1
                    }
                }],
                categorical: {
                    categories: {
                        bind: {
                            to: "Category"
                        }
                    },
                    values: {
                        for: { in: "Values" }
                    }
                }
            }],
            objects: {
                general: {
                    displayName: data.createDisplayNameGetter("Visual_General"),
                    properties: {
                        formatString: {
                            type: {
                                formatting: {
                                    formatString: true
                                }
                            },
                        }
                    },
                },
                dataPoint: {
                    displayName: data.createDisplayNameGetter("Visual_DataPoint"),
                    properties: {
                        fill: {
                            displayName: data.createDisplayNameGetter('Visual_Fill'),
                            type: { fill: { solid: { color: true } } }
                        }
                    }
                },
                labels: {
                    displayName: data.createDisplayNameGetter('Visual_DataPointsLabels'),
                    properties: {
                        labelPrecision: {
                            displayName: data.createDisplayNameGetter('Visual_Precision'),
                            type: { numeric: true }
                        }
                    }
                }
            }
        };

        private static percentileRange: number[];

        private static Identity: ClassAndSelector = {
            "class": "percentileChart",
            selector: ".percentileChart"
        };

        private static Axes: ClassAndSelector = {
            "class": "axes",
            selector: ".axes"
        };

        private static Axis: ClassAndSelector = {
            "class": "axis",
            selector: ".axis"
        };

        private static Legends: ClassAndSelector = {
            "class": "legends",
            selector: ".legends"
        };

        private static Legend: ClassAndSelector = {
            "class": "legend",
            selector: ".legend"
        };

        private static Line: ClassAndSelector = {
            "class": "line",
            selector: ".line"
        };

        private static yAxisTitle: string = "Percentile";
        private static MinPrecision: number = 0;

        private static Properties: any = {
            general: {
                formatString: <DataViewObjectPropertyIdentifier>{
                    objectName: "general",
                    propertyName: "formatString"
                }
            },
            dataPoint: {
                fill: <DataViewObjectPropertyIdentifier>{
                    objectName: "dataPoint",
                    propertyName: "fill"
                }
            },
            labels: {
                labelPrecision: <DataViewObjectPropertyIdentifier>{
                    objectName: "labels",
                    propertyName: "labelPrecision"
                }
            }
        };

        private static DefaultSettings: PercentileChartSettings = {
            fillColor: 'teal',
            precision: 2,
            xAxisTitle: ''
        };

        private model: PercentileChartViewModel;
        private root: D3.Selection;
        private main: D3.Selection;
        private axes: D3.Selection;
        private axisX: D3.Selection;
        private axisY: D3.Selection;
        private legends: D3.Selection;
        private line: D3.Selection;
        private colors: IDataColorPalette;

        private margin: IMargin = {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        };

        private LegendSize: number = 50;
        private AxisSize: number = 30;

        /* One time setup*/
        public init(options: VisualInitOptions): void {
            this.root = d3.select(options.element.get(0))
                .append('svg')
                .classed(PercentileChart.Identity.class, true);

            this.main = this.root.append('g');
            this.axes = this.main.append('g').classed(PercentileChart.Axes.class, true);
            this.axisX = this.axes.append('g').classed(PercentileChart.Axis.class, true);
            this.axisY = this.axes.append('g').classed(PercentileChart.Axis.class, true);
            this.legends = this.main.append('g').classed(PercentileChart.Legends.class, true);
            this.line = this.main.append('g').classed(PercentileChart.Line.class, true);

            this.colors = options.style && options.style.colorPalette
                ? options.style.colorPalette.dataColors
                : new DataColorPalette();

            if (!PercentileChart.percentileRange) {
                let values: number[] = [];
                for (let i = 0; i < 100; i++) {
                    values.push(i);
                }

                PercentileChart.percentileRange = values;
            }
        }

        /* Called for data, size, formatting changes*/ 
        public update(options: VisualUpdateOptions) {
            if (!options.dataViews || !options.dataViews[0]) {
                return;
            }

            let viewport: IViewport = options.viewport;

            let model: PercentileChartViewModel = this.model = this.converter(options.dataViews[0], viewport);
            if (!model) {
                return;
            }

            this.resize(viewport);
            this.draw(model, !options.suppressAnimations);
        }

        /*About to remove your visual, do clean up here */ 
        public destroy() {
            this.root = null;
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
            let instances: VisualObjectInstance[] = [];

            if (!this.model || !this.model.settings) {
                return instances;
            }

            let settings: PercentileChartSettings = this.model.settings;

            switch (options.objectName) {
                case "dataPoint":
                    let dataPoint: VisualObjectInstance = {
                        objectName: "dataPoint",
                        displayName: "dataPoint",
                        selector: null,
                        properties: {
                            fill: settings.fillColor
                        }
                    };

                    instances.push(dataPoint);
                    break;

                case "labels":
                    let labels: VisualObjectInstance = {
                        objectName: "labels",
                        displayName: "labels",
                        selector: null,
                        properties: {
                            labelPrecision: settings.precision
                        }
                    };

                    instances.push(labels);
                    break;
            }

            return instances;
        }

        // Convert a DataView into a view model
        private converter(dataView: DataView, viewport: IViewport): PercentileChartViewModel {
            if (!dataView.categorical ||
                !dataView.categorical.categories ||
                !dataView.categorical.categories[0] ||
                !dataView.categorical.categories[0].values ||
                !(dataView.categorical.categories[0].values.length > 0)) {
                return null;
            }

            Debug.assert(PercentileChart.percentileRange != null, "percentileRange should not be null.");
            Debug.assert(PercentileChart.percentileRange.length === 100, "percentileRange should have 100 values, so that 100 quartiles are computed.");

            let values: any[] = [];
            let metadataColumn: DataViewMetadataColumn;
            let usedValues: boolean = false;
            if (dataView.categorical.values &&
                dataView.categorical.values[0] &&
                dataView.categorical.values[0].values) {
                metadataColumn = dataView.categorical.values[0].source;
                values = dataView.categorical.values[0].values;
                usedValues = true;
            }
            else {
                metadataColumn = dataView.categorical.categories[0].source;
                values = dataView.categorical.categories[0].values;
            }

            if (!this.validateValues(values)) {
                return {
                    percentiles: null,
                    settings: null,
                    xAxis: null,
                    yAxis: null,
                    legends: this.generateLegends(viewport, "Invalid data: Use numeric values")
                };
            }

            // d3.scale.quantile().quantiles() returns an array of N-1 values. In this case,
            // it will return percentiles 1-99.
            // The 0th percentile is everything between the minimum value in the dataset
            // and the 1st percentile.
            // The 100th percentile is everything between the 99th percentile and the
            // maximum value in the dataset.
            let extent: number[] = d3.extent(values);
            let min: number = extent[0];
            let max: number = extent[1];
            let percentiles: number[] = d3.scale.quantile()
                .domain(values)
                .range(PercentileChart.percentileRange)
                .quantiles();

            percentiles.unshift(min);
            percentiles.push(max);

            Debug.assert(percentiles.length === 101, "We should have all percentiles (0-100) now.");

            let result: Percentile[] = [];
            for (let i = 0; i < 101; i++) {
                result.push({
                    percentile: i,
                    value: percentiles[i]
                });
            }

            let settings: PercentileChartSettings = this.parseSettings(dataView, usedValues);
            let effectiveWidth: number = Math.max(0, viewport.width - this.margin.left - this.margin.right - this.LegendSize - this.AxisSize);
            let effectiveHeight: number = Math.max(0, viewport.height - this.margin.top - this.margin.bottom - this.LegendSize);

            let xAxis = AxisHelper.createAxis({
                pixelSpan: effectiveWidth,
                dataDomain: [min, max],
                metaDataColumn: metadataColumn,
                formatStringProp: PercentileChart.Properties.general.formatString,
                outerPadding: 0,
                isCategoryAxis: false,
                isScalar: true,
                isVertical: false,
                useTickIntervalForDisplayUnits: true,
                axisPrecision: settings.precision
            });

            let yAxis = AxisHelper.createAxis({
                pixelSpan: effectiveHeight,
                dataDomain: [0, 100],
                metaDataColumn: null,
                formatStringProp: null,
                outerPadding: 0,
                isCategoryAxis: false,
                isScalar: true,
                isVertical: true,
                useTickIntervalForDisplayUnits: true
            });

            // Show gridlines on the chart to make the values more readable.
            // TODO: Make this a configuration setting that can be toggled.
            xAxis.axis = xAxis.axis.tickSize(-effectiveHeight);
            yAxis.axis = yAxis.axis.tickSize(-effectiveWidth);

            return {
                percentiles: result,
                settings: settings,
                xAxis: xAxis,
                yAxis: yAxis,
                legends: this.generateLegends(viewport, settings.xAxisTitle)
            };
        }

        private validateValues(values: any[]): boolean {
            // Ensure that all values are numerical, since computing percentiles
            // only makes sense for numerical values.
            return _.all(values, (x) => typeof x === 'number' && isFinite(x));
        }

        private parseSettings(dataView: DataView, usedValues: boolean): PercentileChartSettings {
            if (!dataView ||
                !dataView.metadata ||
                !dataView.metadata.columns ||
                !dataView.metadata.columns[0]) {
                return null;
            }

            let objects: DataViewObjects = dataView.metadata.objects;
            let colorHelper: ColorHelper = new ColorHelper(this.colors, PercentileChart.Properties.dataPoint.fill, PercentileChart.DefaultSettings.fillColor);
            let xAxisTitle: string = PercentileChart.DefaultSettings.xAxisTitle;

            if (usedValues) {
                if (dataView.metadata.columns.length > 1 &&
                    dataView.metadata.columns[0].displayName &&
                    dataView.metadata.columns[1].displayName) {
                    xAxisTitle = dataView.metadata.columns[1].displayName + ' per ' + dataView.metadata.columns[0].displayName;
                }
            }
            else {
                if (dataView.metadata.columns[0].displayName) {
                    xAxisTitle = dataView.metadata.columns[0].displayName;
                }
            }

            return {
                precision: PercentileChart.getPrecision(objects),
                xAxisTitle: xAxisTitle,
                fillColor: colorHelper.getColorForMeasure(objects, '')
            };
        }

        private static getPrecision(objects: DataViewObjects): number {
            if (!objects) {
                return PercentileChart.DefaultSettings.precision;
            }

            let precision: number = DataViewObjects.getValue(
                objects,
                PercentileChart.Properties.labels.labelPrecision,
                PercentileChart.DefaultSettings.precision);

            if (precision < PercentileChart.MinPrecision) {
                return PercentileChart.MinPrecision;
            }

            return precision;
        }

        private generateLegends(viewport: IViewport, xAxisTitle: string): Legend[] {
            return [
                {
                    transform: SVGUtil.translate(
                        (viewport.width - this.margin.left - this.margin.right) / 2,
                        (viewport.height - this.margin.top - this.margin.bottom)),
                    text: xAxisTitle,
                    dx: "1em",
                    dy: "-1em"
                }, {
                    transform: SVGUtil.translateAndRotate(
                        0,
                        (viewport.height - this.margin.top - this.margin.bottom) / 2,
                        0,
                        0,
                        270),
                    text: PercentileChart.yAxisTitle,
                    dx: "3em"
                }
            ];
        }

        private resize(viewport: IViewport): void {
            this.root.attr({
                'height': Math.max(0, viewport.height),
                'width': Math.max(0, viewport.width)
            });

            this.main.attr('transform', SVGUtil.translate(this.margin.left, this.margin.top));
            this.legends.attr('transform', SVGUtil.translate(this.margin.left, this.margin.top));
            this.line.attr('transform', SVGUtil.translate(this.margin.left + this.LegendSize, 0));
            this.axes.attr('transform', SVGUtil.translate(this.margin.left + this.LegendSize, 0));
            this.axisX.attr('transform', SVGUtil.translate(0, viewport.height - this.margin.top - this.margin.bottom - this.LegendSize));
        }

        private draw(model: PercentileChartViewModel, animate: boolean): void {
            // Draw the legend text for both axes
            this.renderLegends(model);

            if (model && model.percentiles) {
                let animateDuration: number = animate ? 250 : 0;

                this.axisX.call(model.xAxis.axis);
                this.axisY.call(model.yAxis.axis);

                // Draw the percentile line
                let line: D3.Svg.Line = d3.svg.line()
                    .x((d: Percentile) => model.xAxis.scale(d.value))
                    .y((d: Percentile) => model.yAxis.scale(d.percentile))
                    .interpolate("basis");

                let lineSelection: D3.UpdateSelection = this.line.selectAll('path')
                    .data([model.percentiles]);

                lineSelection.enter().append('path');
                lineSelection
                    .attr('stroke', (d, i) => model.settings.fillColor)
                    .transition()
                    .duration(animateDuration)
                    .attr('d', line);
                lineSelection.exit().remove();

                // Draw the individual data points that will be shown on hover with a tooltip
                let pointSelection: D3.UpdateSelection = this.line.selectAll('circle')
                    .data(model.percentiles);

                pointSelection.enter()
                    .append('circle')
                    .attr('r', 5)
                    .classed('point', true)
                    .on('mouseover.point', this.showDataPoint)
                    .on('mouseout.point', this.hideDataPoint);
                let points: D3.Selection = pointSelection
                    .attr('cx', (d: Percentile) => model.xAxis.scale(d.value))
                    .attr('cy', (d: Percentile) => model.yAxis.scale(d.percentile));
                pointSelection.exit().remove();

                for (let i = 0; i < points[0].length; i++) {
                    this.addTooltip(model, points[0][i]);
                }
            }
        }

        private showDataPoint(data: Percentile, index: number): void {
            d3.select(<any>this).classed('show', true);
        }

        private hideDataPoint(data: Percentile, index: number): void {
            d3.select(<any>this).classed('show', false);
        }

        private addTooltip(model: PercentileChartViewModel, element: any): void {
            let selection: D3.Selection = d3.select(element);
            let data: Percentile = selection.datum();
            TooltipManager.addTooltip(selection, (event) => {
                return [{
                    displayName: PercentileChart.yAxisTitle,
                    value: data.percentile.toString()
                }, {
                    displayName: "Value",
                    value: model.xAxis.formatter.format(data.value)
                }];
            });
        }

        private renderLegends(model: PercentileChartViewModel): void {
            let legendSelection: D3.UpdateSelection = this.legends
                .selectAll(PercentileChart.Legend.selector)
                .data(model.legends);

            legendSelection
                .enter()
                .append("svg:text");

            legendSelection
                .attr("x", 0)
                .attr("y", 0)
                .attr("dx", (item: Legend) => item.dx)
                .attr("dy", (item: Legend) => item.dy)
                .attr("transform", (item: Legend) => item.transform)
                .text((item: Legend) => item.text)
                .classed(PercentileChart.Legend.class, true);

            legendSelection
                .exit()
                .remove();
        }
    }
}