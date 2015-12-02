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
    import ValueFormatter = valueFormatter;

    export interface Percentile {
        percentile: number;
        value: number;
    }

    interface Legend {
        text: string;
        transform?: string;
        dx?: string;
        dy?: string;
    }

    export interface PercentileChartViewModel {
        percentiles: Percentile[];
        settings: PercentileChartSettings;
        formatter: IValueFormatter;
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
            dataRoles: [
                {
                    name: "Category",
                    kind: VisualDataRoleKind.Grouping
                },
                {
                    name: "Y",
                    kind: VisualDataRoleKind.Measure
                }
            ],
            dataViewMappings: [{
                conditions: [
                    { 'Category': { max: 1 }, 'Y': { max: 1 } },
                ],
                categorical: {
                    categories: {
                        for: { in: 'Category' },
                        dataReductionAlgorithm: { top: {} }
                    },
                    values: {
                        select: [{ bind: { to: 'Y' } }]
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
            precision: 0,
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

            let model: PercentileChartViewModel = this.model = this.converter(options.dataViews[0]);
            if (!model) {
                return;
            }

            let viewport: IViewport = options.viewport;

            this.resize(viewport);
            this.draw(model, viewport, !options.suppressAnimations);
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
        private converter(dataView: DataView): PercentileChartViewModel {
            if (!dataView.categorical ||
                !dataView.categorical.categories ||
                !dataView.categorical.categories[0] ||
                !dataView.categorical.categories[0].values ||
                !(dataView.categorical.categories[0].values.length > 0)) {
                return null;
            }

            Debug.assert(PercentileChart.percentileRange != null, "percentileRange should not be null.");
            Debug.assert(PercentileChart.percentileRange.length === 100, "percentileRange should have 100 values, so that 100 quartiles are computed.");

            let values: number[] = dataView.categorical.categories[0].values;

            // d3.scale.quantile().quantiles() returns an array of N-1 values. In this case,
            // it will return percentiles 1-99.
            // The 0th percentile is everything between the minimum value in the dataset
            // and the 1st percentile.
            // The 100th percentile is everything between the 99th percentile and the
            // maximum value in the dataset.
            let min: number = d3.min(values);
            let max: number = d3.max(values);
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

            let settings: PercentileChartSettings = this.parseSettings(dataView);
            let formatter: IValueFormatter = ValueFormatter.create({
                format: ValueFormatter.getFormatString(dataView.categorical.categories[0].source, PercentileChart.Properties.general.formatString),
                value: values[0],
                precision: settings.precision
            });

            return {
                percentiles: result,
                settings: settings,
                formatter: formatter
            };
        }

        private parseSettings(dataView: DataView): PercentileChartSettings {
            if (!dataView ||
                !dataView.metadata ||
                !dataView.metadata.columns ||
                !dataView.metadata.columns[0]) {
                return null;
            }

            let objects: DataViewObjects = dataView.metadata.objects;
            let colorHelper: ColorHelper = new ColorHelper(this.colors, PercentileChart.Properties.dataPoint.fill, PercentileChart.DefaultSettings.fillColor);

            return {
                precision: PercentileChart.getPrecision(objects),
                xAxisTitle: dataView.metadata.columns[0].displayName || PercentileChart.DefaultSettings.xAxisTitle,
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

            if (precision <= PercentileChart.MinPrecision) {
                return PercentileChart.MinPrecision;
            }

            return precision;
        }

        private resize(viewport: IViewport): void {
            this.root.attr({
                'height': viewport.height,
                'width': viewport.width
            });

            this.main.attr('transform', SVGUtil.translate(this.margin.left, this.margin.top));
            this.legends.attr('transform', SVGUtil.translate(this.margin.left, this.margin.top));
            this.line.attr('transform', SVGUtil.translate(this.margin.left + this.LegendSize, 0));
            this.axes.attr('transform', SVGUtil.translate(this.margin.left + this.LegendSize, 0));
            this.axisX.attr('transform', SVGUtil.translate(0, viewport.height - this.margin.top - this.margin.bottom - this.LegendSize));
        }

        private draw(model: PercentileChartViewModel, viewport: IViewport, animate: boolean): void {
            let effectiveWidth: number = viewport.width - this.margin.left - this.margin.right - this.LegendSize - this.AxisSize;
            let effectiveHeight: number = viewport.height - this.margin.top - this.margin.bottom - this.LegendSize;
            let animateDuration: number = animate ? 250 : 0;

            // Set up the domain to align with the ticks so it looks nicer.
            let domainMin: number = Math.round(model.percentiles[0].value / 10.0 - 0.499999) * 10;
            let domainMax: number = Math.round(model.percentiles[100].value / 10.0 + 0.499999) * 10;

            let x: D3.Scale.LinearScale = d3.scale.linear()
                .domain([domainMin, domainMax])
                .range([0, effectiveWidth]);

            // Draw the axes
            let y: D3.Scale.LinearScale = d3.scale.linear()
                .domain([0, 100])
                .range([effectiveHeight, 0]);

            let xAxis: D3.Svg.Axis = d3.svg.axis()
                .scale(x)
                .orient('bottom')
                .ticks(10)
                .tickSize(-effectiveHeight)
                .tickFormat(v => model.formatter.format(v));

            let yAxis: D3.Svg.Axis = d3.svg.axis()
                .scale(y)
                .orient('left')
                .ticks(5)
                .tickSize(-effectiveWidth);

            this.axisX.call(xAxis);
            this.axisY.call(yAxis);

            // Draw the legend text for both axes
            this.renderLegends(viewport);

            // Draw the percentile line
            let line: D3.Svg.Line = d3.svg.line()
                .x((d: Percentile) => x(d.value))
                .y((d: Percentile) => y(d.percentile))
                .interpolate("basis");

            let lineSelection: D3.UpdateSelection = this.line.selectAll('path')
                .data([model.percentiles]);

            lineSelection.enter().append('path');
            lineSelection
                .attr('stroke', (d, i) => this.colors.getColorByIndex(i).value)
                .transition()
                .duration(animateDuration)
                .attr('d', line);
            lineSelection.exit().remove();

            // Draw the individual data points that will be shown on hover with a tooltip
            let pointSelection: D3.UpdateSelection = this.line.selectAll('circle')
                .data(model.percentiles);

            var newPoints: D3.Selection = pointSelection.enter()
                .append('circle')
                .attr('r', 5)
                .classed('point', true)
                .on('mouseover.point', this.showDataPoint)
                .on('mouseout.point', this.hideDataPoint);
            pointSelection
                .attr('cx', (d: Percentile) => x(d.value))
                .attr('cy', (d: Percentile) => y(d.percentile));
            pointSelection.exit().remove();

            for (let i = 0; i < newPoints[0].length; i++) {
                this.addTooltip(model, newPoints[0][i]);
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
                    value: model.formatter.format(data.value)
                }];
            });
        }

        private renderLegends(viewport: IViewport): void {
            let datalegends: Legend[] = [
                {
                    transform: SVGUtil.translate(
                        (viewport.width - this.margin.left - this.margin.right) / 2,
                        (viewport.height - this.margin.top - this.margin.bottom)),
                    text: this.model.settings.xAxisTitle,
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

            let legendSelection: D3.UpdateSelection = this.legends
                .selectAll(PercentileChart.Legend.selector)
                .data(datalegends);

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

module powerbi.visuals.plugins {
    export var percentileChart: IVisualPlugin = {
        name: 'percentileChart',
        capabilities: PercentileChart.capabilities,
        create: () => new PercentileChart()
    };
}