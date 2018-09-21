import React, { Component } from 'react';
import { List } from 'react-virtualized';
import { isEmptyArray, generateTreeDataMap, delArrayItem, childrenChain, parentChain, findAllChildren, getFilterIdList, treeDataMapCheckRenderIdList } from './tool';
import './style/index.css';
import SearchBox from './searchBox'
import PropTypes from 'prop-types';

const defaultProps = {
    style: { width: 320, height: 800, overflow: 'auto' },
    showlevel: 0,
    checkbox: {
        enable: false,
        parentChain: true, 	    // 影响父级节点； 
        childrenChain: true,	// 影响子级节点;		
        halfChain: true, 	    // 即使子级节点被全部选中影响父级节点半选； 
        initCheckedList: []	    // 初始化多选数组
    },
    prefixClassName: 'do',
    paddingLeftLevel: 20,
}

class TreeSelect extends Component {
    constructor(props) {
        super(props);
        this.state = {
            treeData: [],           // 树数据
            treeDataMap: {},        // 树数据映射表
            idList: [],             // 所有列表
            renderIdList: [],       // 渲染的列表
            checkedList: [],        // 选中的列表
            searchVal: '',          // 搜索的值
            selectVal: '',          // 选中的条目
            checkbox: {},           // 复选框的配置
            showlevel: 0,           // 展开的层级
            updateListState: false  // 强制更新List组件
        }
        this.treeNodeRender = this.treeNodeRender.bind(this);
        this.onClickRow = this.onClickRow.bind(this);
        this.onChecked = this.onChecked.bind(this);
        this.onSearch = this.onSearch.bind(this);
        this.cacheIdList = null;
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        const defaultConfig = {
            showlevel: nextProps.showlevel || defaultProps.showlevel,
            checkbox: nextProps.checkbox || defaultProps.checkbox
        }
        if (nextProps.treeData !== prevState.treeData) {
            const { map, idList, renderIdList } = generateTreeDataMap({}, nextProps.treeData, defaultConfig)
            return {
                treeData: nextProps.treeData,
                value: nextProps.value,
                treeDataMap: map,
                idList: idList,
                renderIdList: renderIdList,
                selectVal: nextProps.selectVal,
                checkbox: defaultConfig.checkbox,
                showlevel: defaultConfig.showlevel
            }
        }
        return null
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevState.treeData != this.state.treeData) {
            const { checkbox, treeDataMap } = this.state;
            const { initCheckedList } = checkbox;
            if (!isEmptyArray(initCheckedList)) {
                initCheckedList.forEach((_item) => {
                    treeDataMap[_item] && this.onChecked(treeDataMap[_item])
                })
            }

        }
    }

    componentDidCatch(err) {
        console.log(err)
    }


    /**
     * [onClickRow 每行节点点击事件回调函数]
     * @method onClickRow
     * @param  {[Object]}  item [被点击节点的集合]
     * @param  {[Event]}   e    [事件]
     * 
     */
    onClickRow(item, e) {
        const { onSelect } = this.props;
        const { renderIdList, treeDataMap, updateListState } = this.state
        const { value } = item
        let _renderIdList = renderIdList.concat([])
        // const disabled = item.disabled && (!item.children || !isEmptyArray(item.children))
        // if(disabled) {
        //     return
        // }

        const isExpand = treeDataMap[item.value].isExpand = !treeDataMap[item.value].isExpand
        if (isExpand) {
            // 展开
            if (!isEmptyArray(item.children)) {
                // 找到这个val在renderIdList中的索引
                const idx = this.findIdListInValIdx(value, _renderIdList)
                const _children = item.children.concat([])
                // 在这个val后面插入
                _children.unshift(idx + 1, 0);
                Array.prototype.splice.apply(_renderIdList, _children);
            }
        } else {
            // 收缩
            if (!isEmptyArray(item.children)) {
                // 找到children的所有子节点
                const arr = findAllChildren(item.children, treeDataMap)
                arr.forEach((_item) => {
                    treeDataMap[_item].isExpand = false;
                    delArrayItem(_renderIdList, _item)
                })
            }
        }

        this.setState({
            renderIdList: _renderIdList,
            treeDataMap,
            selectVal: value,
            updateListState: !updateListState
        }, () => {
            onSelect && onSelect(item, e)
        })
    }

    /**
     * [checked 节点的选中情况]
     * @method checked
     * @param  {[Object]}  item [被点击节点的集合]
     * @param  {[Event]}   e    [事件]
     * 
     */
    onChecked(item, e) {
        e && e.stopPropagation();
        const { checkbox, onChecked } = this.props
        const { treeDataMap, checkedList, updateListState } = this.state
        const { checkStatus, value } = item
        const { checked } = checkStatus
        const _checkbox = checkbox || defaultProps.checkbox
        // 判断是否是禁用
        const disabled = item.disabled
        if (disabled) {
            return
        }
        // 影响性能，直接修改Map值
        // const _treeDataMap = Object.assign({}, treeDataMap)
        const _treeDataMap = treeDataMap

        const _checked = !checked;
        const _checkedList = checkedList.concat([]);

        // 处理勾选的value List
        if (_checked) {
            _checkedList.push(value)
        } else {
            delArrayItem(_checkedList, value)
        }

        // 处理treeDataMap的数据状态
        _treeDataMap[value] = {
            ..._treeDataMap[value],
            checkStatus: {
                ..._treeDataMap[value].checkStatus,
                checked: _checked,
                halfChecked: false
            }
        }

        // 处理复选框联动逻辑
        _checkbox.parentChain && parentChain(_treeDataMap, _treeDataMap[item.parentVal], _checkbox, _checkedList)
        _checkbox.childrenChain && childrenChain(_treeDataMap, item.children, _checked, _checkedList)
        this.setState({
            treeDataMap: _treeDataMap,
            checkedList: _checkedList,
            updateListState: !updateListState
        }, () => {
            e && onChecked && onChecked(this.state.checkedList, e)
        })
    }


    // 查找在idList中val的索引
    findIdListInValIdx(val, idList) {
        return idList.indexOf(val)
    }

    // 渲染TreeNode
    treeNodeRender({
        index,       // Index of row
        // isScrolling, // The List is currently being scrolled
        // isVisible,   // This row is visible within the List (eg it is not an overscanned row)
        // key,         // Unique key within array of rendered rows
        // parent,      // Reference to the parent List (instance)
        style        // Style object to be applied to row (to position it);
        // This must be passed through to the rendered row element.
    }) {
        const { checkbox, customIconRender, customTitleRender } = this.props
        const { idList, treeDataMap, renderIdList, selectVal } = this.state
        const prefixClassName = defaultProps.prefixClassName;
        const idx = renderIdList[index]
        const item = treeDataMap[idx];
        if (!item) return
        if (item.parentVal && !treeDataMap[item.parentVal].isExpand) {
            // 父级借点属性为不展开，子节点不应该显示
            throw new Error('this item should not be show')
        }
        const _style = {
            ...style,
            paddingLeft: (defaultProps.paddingLeftLevel * item.level)
        }
        const checkedClassName = item.checkStatus.checked ? `${prefixClassName}-checkbox-checked` : ''
        const halfCheckedClassName = item.checkStatus.halfChecked ? `${prefixClassName}-checkbox-halfChecked` : ''
        const disabled = item.disabled && (!item.children || !isEmptyArray(item.children))
        const isSelectVal = selectVal == item.value
        const _checkbox = checkbox || defaultProps.checkbox
        return (
            <div
                key={item.value}
                style={{ ..._style, width: 'auto' }}
                onClick={(e) => this.onClickRow(item, e)}
                className={`${prefixClassName}-TreeNode`}
            >
                <div className={`${prefixClassName}-fadeIn ${item.disabled ? 'disabled' : ''}`} >
                    <div className={`${prefixClassName}-expandIcon`}>
                        {
                            !isEmptyArray(item.children) &&
                            <i className={`${item.isExpand && prefixClassName + '-expand'}`}></i>
                        }
                    </div>
                    {
                        _checkbox.enable &&
                        <div onClick={(e) => this.onChecked(item, e)} className={`${prefixClassName}-checkbox ${checkedClassName} ${halfCheckedClassName}`}>
                            <span className={`${prefixClassName}-checkbox-inner ${disabled ? 'disabled' : ''}`}></span>
                        </div>
                    }
                    <div title={item.title} className={`${prefixClassName}-title ${isSelectVal ? 'active' : ''}`}>
                        {customTitleRender ? customTitleRender(item) : item.title}
                    </div>
                    <div className={`${prefixClassName}-customIcon`}>
                        {
                            customIconRender ?
                                customIconRender(item)
                                :
                                ''
                        }
                    </div>
                </div>
            </div>
        )
    }

    // 搜索框的回调函数
    onSearch(val) {
        let _filterIdList;
        const { idList, treeDataMap, renderIdList } = this.state;
        // 影响性能，直接修改Map值
        // const _treeDataMap = Object.assign({}, treeDataMap)
        const _treeDataMap = treeDataMap

        if (!this.cacheIdList) {
            this.cacheIdList = renderIdList
        }

        if (val) {
            _filterIdList = getFilterIdList(idList, _treeDataMap, val)
        } else {
            _filterIdList = this.cacheIdList
            this.cacheIdList = null
        }

        _filterIdList = treeDataMapCheckRenderIdList(_treeDataMap, _filterIdList)

        this.setState({
            searchVal: val,
            renderIdList: _filterIdList,
            treeDataMap: _treeDataMap,
            updateListState: !updateListState
        })
    }

    render() {
        const { style, wrapperClassName } = this.props;
        const { treeDataMap, renderIdList, searchVal, checkedList, selectVal, updateListState } = this.state;
        const _style = style || defaultProps.style;
        const prefixClassName = defaultProps.prefixClassName;
        const _className = `${prefixClassName}-TreeSelect ${wrapperClassName || ''}`
        return (
            <div className={_className} style={{ width: _style.width }}>
                <SearchBox defaultProps={defaultProps} searchVal={searchVal} onSearch={this.onSearch} />
                <div className={`${prefixClassName}-TreeSelectList`} style={{ ..._style, overflow: 'unset' }}>
                    <List
                        width={_style.width}
                        height={_style.height}
                        rowCount={renderIdList.length}
                        rowHeight={22}
                        rowRenderer={this.treeNodeRender}
                        overscanRowCount={20}
                        autoContainerWidth={true}
                        treeDataMap={treeDataMap}
                        checkedList={checkedList}
                        selectVal={selectVal}
                        updateListState={updateListState}
                    />
                </div>
            </div>
        );
    }
}


// [propTypes 属性类型定义]
TreeSelect.propTypes = {
    treeData:               PropTypes.array.isRequired,                 // 元数据
    style:                  PropTypes.object,                           // 样式
    checkbox:               PropTypes.object,                           // 复选框配置
    showlevel:              PropTypes.number,                           // 显示层级
    selectVal:              PropTypes.string,                           // 选中的值
    onSelect:               PropTypes.func,                             // 选择的回调函数
    onChecked:              PropTypes.func,                             // 复选框勾选的回调函数
    wrapperClassName:       PropTypes.string,                           // 扩展classname
    customIconRender:       PropTypes.func,                             // 自定义扩展Icon渲染
    customTitleRender:      PropTypes.func,                             // 自定义标题渲染
};


export default TreeSelect;
