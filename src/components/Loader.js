import React, {Component} from 'react';
import {Helper} from "../Helper";

/**
 * @author Leo Fajardo
 */
class Loader extends Component {
    constructor (props) {
        super(props);
    }

    render() {
        return (
            <div className="fs-modal fs-modal--loading">
                <section className="fs-content-container">
                    <div className="fs-content">
                        {Helper.isNonEmptyString(this.props.title) && <span>{this.props.title}</span>}
                        <i></i>
                    </div>
                </section>
            </div>
        );
    }
}

export default Loader;