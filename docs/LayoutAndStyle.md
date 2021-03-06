---
id: layout-and-style
title: Layout and Style
layout: docs
category: The Basics
permalink: docs/layout-and-style.html
next: events-and-links
previous: reactnative
---

React VR makes use of a Flexbox style layout algorithm to automatically position components and their children.

The library we use, [Yoga](https://github.com/facebook/yoga), tries to follows the web implementation of flexbox as much as possible. Yoga does make changes to the default properties, and [these changes](http://jsfiddle.net/vjeux/y11txxv9/) can be forked to allow testing in a browser environment.

#### Layout Sample

In most cases, children are arranged vertically in a `'column'` or horizontally in a `'row'`. This arrangement behavior, as well as size and alignment, are controlled through style properties of the component.

Here are some of the more common attributes:

* `flexDirection` - Can be `column` or `row`.
* `justifyContent` - Can be `flex-start`, `space-around`, `center`, `space-between`, or `flex-end`.
* `alignItems` - Can be `stretch`, `flex-start`, `center`, or `flex-end`.
* `margin` - specifies space around the item.

The behavior of these and other layout attributes is demonstrated by the *LayoutSample* included
with React VR. This sample displays the following scene, with buttons arranged vertically:

![](img/layoutsample.jpg)

Colored buttons with text can be generated by the following code within a component:

```
render() {
  // <View> below creates a view that is 2 meters wide and is positioned
  // 5 meters in front of the user (z = -5). Its child items are laid out
  // in a 'column' and marked to 'stretch' to the width of the view container.
  // This causes call child view to have the same width.
  return (
    <View>
      <Pano source={asset('chess-world.jpg')}/>
      <View style={{
        flex: 1,
        flexDirection: 'column',
        width: 2,
        alignItems: 'stretch',
        transform: [{translate: [-1, 1, -5]}],
      }}>

      <View style={{ margin: 0.1, height: 0.3, backgroundColor: 'red'}}>
        <Text style={{fontSize: 0.2, textAlign: 'center'}}>Red</Text>
      </View>
      <View style={{ margin: 0.1, height: 0.3, backgroundColor: 'orange'}}>
        <Text style={{fontSize: 0.2, textAlign: 'center'}}>Orange</Text>
      </View>
      <View style={{ margin: 0.1, height: 0.3, backgroundColor: 'yellow'}}>
        <Text style={{fontSize: 0.2, textAlign: 'center'}}>Yellow</Text>
      </View>
      <View style={{ margin: 0.1, height: 0.3, backgroundColor: 'green'}}>
        <Text style={{fontSize: 0.2, textAlign: 'center'}}>Green</Text>
      </View>
      <View style={{ margin: 0.1, height: 0.3, backgroundColor: 'blue'}}>
        <Text style={{fontSize: 0.2, textAlign: 'center'}}>Blue</Text>
      </View>

    </View>
    </View>
  );
}
```


For more information about layout, see [Layout with Flexbox](https://facebook.github.io/react-native/docs/flexbox.html) in the React Native docs.



#### Style

React VR doesn't use a special language or syntax for defining styles. All of the core and VR components accept a prop named `style`. You just style your application using JavaScript. Here is an example of a view with style applied to it:

```
<View style={{
          flex: 1, flexDirection: 'column',
          width: 2,
          alignItems: 'stretch',
          transform: [{translate: [-1, 1, -5]}]
}}>
```

The style names and values usually match how CSS works on the web, except names are written like `backgroundColor` instead of `background-color`.

The style prop can be a plain old JavaScript object. In the above example, we declared an inline object with attributes `flex`, `width`, and so on.  This direct inline approach is simple and is what we usually do for sample code.

As a component grows in complexity, it is often cleaner to use `StyleSheet.create` to define several styles in one place.

```
const styles = StyleSheet.create({
  bigblue: {
    color: 'blue',
    fontSize: 0.4
  },
  red: {
    color: 'red',
  },
});
```

Such styles can be used directly inside of the style property. The shorter syntax encourages style reuse.

```
<Text style={styles.bigblue}>bigblue colored text</Text>
```

You can also pass an array of styles:

```
<Text style={[styles.bigblue, styles.red]}>red text</Text>
<Text style={[styles.bigblue, {color:'green'}]}>green text</Text>
```

In style arrays, the styles are merged and the members of the last array element take precedence. This means we can use this approach to help inherit styles or override their elements.


#### Width and Height

A component's width and height style properties determine its size in the world and during layout.

React VR uses meters as its units unlike React Native, which uses pixels. Using meters is important, as it gives meaningful physical size to the object in the VR world. Meter units are also used by the WebVR APIs.

### Units

The distance and dimensional units for the Web version of React VR are meters.
