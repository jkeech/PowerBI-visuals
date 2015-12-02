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

/// <reference path="../_references.ts"/>

module powerbi.visuals.sampleDataViews {
    import DataView = powerbi.DataView;
    import DataViewMetadata = powerbi.DataViewMetadata;
    import ValueType = powerbi.ValueType;

    export class SimpleHistogramData 
        extends SampleDataViews
        implements ISampleDataViewsMethods {

        public name: string = "SimpleHistogramData";
        public displayName: string = "Simple Histogram Data";

        public visuals: string[] = ["histogram", "percentileChart"];

        private minValue: number = 1;
        private maxValue: number = 120;

        private minLength: number = 5;
        private maxLength: number = 100;

        private sampleData: number[] = [
            36, 25, 38, 46, 55, 68, 72, 55, 36, 38,
            67, 45, 22, 48, 91, 46, 52, 61, 58, 55,
            25, 30, 34, 35, 33, 32, 8, 10, 1, 4, 3,
            96, 86, 35, 22, 23, 21, 20, 19, 16, 89,
            100, 105, 103, 101, 101, 100, 5, 6, 5,
            11, 19, 18, 18, 17, 14, 3, 2, 1, 6, 75,
            31, 31, 32, 33, 34, 30, 29, 45, 42, 43,
            27, 28, 29, 26, 25, 24, 23, 30, 31, 32
        ];

        public getDataViews(): DataView[] {
            let dataViewMetadata: DataViewMetadata = {
                    columns: [{
                        displayName: "Age",
                        queryName: "Age",
                        type: ValueType.fromDescriptor({
                            text: true
                        }),
                        objects: {
                            dataPoint: {
                                fill: {
                                    solid: {
                                        color: "rgb(1, 184, 170)"
                                    }
                                }
                            }
                        }
                    }]
                };

            return [{
                metadata: dataViewMetadata,
                categorical: {
                    categories: [{
                        source: dataViewMetadata.columns[0],
                        values: this.sampleData
                    }]
                }
            }];
        }

        public randomize(): void {
            let length: number =
                Math.round(this.getRandomValue(this.minLength, this.maxLength));

            this.sampleData = [];

            for (let i = 0; i < length; i++) {
                let value: number = this.getRandomValue(this.minValue, this.maxValue);

                this.sampleData.push(Math.round(value));
            }
        }
    }
}